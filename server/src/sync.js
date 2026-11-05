import { db } from './db.js';
import { COLUNAS_SCROBBLE, duracaoFaixa, generoArtista, paginaRecentes } from './lastfm.js';

/** Estado em memória por usuário, exposto em /api/status. */
const estados = new Map();

function estadoVazio() {
  return { running: false, phase: 'idle', done: 0, total: 0, lastSyncAt: null, lastError: null };
}

/** Estado de sincronização do usuário (criado sob demanda). */
export function syncStateDe(user) {
  if (!estados.has(user)) estados.set(user, estadoVazio());
  return estados.get(user);
}

const PARALELO = 4; // o limite de requisições/s é controlado em lastfm.js

async function emPool(itens, fn) {
  let indice = 0;
  const trabalhadores = Array.from({ length: Math.min(PARALELO, itens.length) }, async () => {
    while (indice < itens.length) {
      const item = itens[indice++];
      await fn(item);
    }
  });
  await Promise.all(trabalhadores);
}

/**
 * 1) Scrobbles novos do usuário. As páginas são lidas da MAIS ANTIGA para a mais nova, com "to" fixo,
 *    e cada lote só é gravado quando inteiro. Se a carga inicial for interrompida,
 *    a próxima continua de onde parou (a partir do MAX(uts) do usuário) sem deixar buracos.
 */
async function sincronizarScrobbles(user, estado) {
  const [[{ maxUts }]] = await db.query('SELECT MAX(uts) AS maxUts FROM scrobbles WHERE lastfm_user = ?', [user]);
  const from = maxUts ? Number(maxUts) + 1 : undefined;
  const to = Math.floor(Date.now() / 1000);
  const primeira = await paginaRecentes(user, 1, from, to);
  const totalPages = primeira.totalPages;
  estado.phase = 'scrobbles';
  estado.done = 0;
  estado.total = totalPages;
  if (!totalPages) return 0;

  let novos = 0;
  const LOTE = 4;
  for (let fim = totalPages; fim >= 1; fim -= LOTE) {
    const paginas = [];
    for (let p = fim; p > Math.max(0, fim - LOTE); p--) paginas.push(p);
    const respostas = await Promise.all(paginas.map((p) => (p === 1 ? primeira : paginaRecentes(user, p, from, to))));
    const linhas = respostas.flatMap((resposta) => resposta.linhas);
    if (linhas.length) {
      const [resultado] = await db.query(`INSERT IGNORE INTO scrobbles (${COLUNAS_SCROBBLE.join(', ')}) VALUES ?`, [linhas]);
      novos += resultado.affectedRows;
    }
    estado.done = totalPages - Math.max(0, fim - LOTE);
  }
  return novos;
}

/** 2) Duração das músicas do usuário ainda sem registro (cache compartilhado entre usuários). */
async function sincronizarDuracoes(user, estado) {
  const [pendentes] = await db.query(`
    SELECT s.track_key, MIN(s.artist) AS artist, MIN(s.track) AS track
    FROM scrobbles s
    LEFT JOIN track_durations d ON d.track_key = s.track_key
    WHERE s.lastfm_user = ? AND d.track_key IS NULL
    GROUP BY s.track_key`, [user]);
  estado.phase = 'durations';
  estado.done = 0;
  estado.total = pendentes.length;
  let gravadas = 0;
  await emPool(pendentes, async ({ track_key: chave, artist, track }) => {
    const ms = await duracaoFaixa(artist, track);
    if (ms !== null) {
      await db.query(
        'INSERT INTO track_durations (track_key, artist, track, duration_ms) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE duration_ms = VALUES(duration_ms), fetched_at = NOW()',
        [chave, artist, track, ms],
      );
      gravadas++;
    }
    estado.done++;
  });
  return gravadas;
}

/** 3) Gênero dos artistas do usuário ainda sem registro (cache compartilhado entre usuários). */
async function sincronizarGeneros(user, estado) {
  const [pendentes] = await db.query(`
    SELECT s.artist_key, MIN(s.artist) AS artist
    FROM scrobbles s
    LEFT JOIN artist_genres g ON g.artist_key = s.artist_key
    WHERE s.lastfm_user = ? AND g.artist_key IS NULL
    GROUP BY s.artist_key`, [user]);
  estado.phase = 'genres';
  estado.done = 0;
  estado.total = pendentes.length;
  let gravados = 0;
  await emPool(pendentes, async ({ artist_key: chave, artist }) => {
    const genero = await generoArtista(artist);
    if (genero !== null) {
      await db.query(
        'INSERT INTO artist_genres (artist_key, artist, genre) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE genre = VALUES(genre), fetched_at = NOW()',
        [chave, artist, genero],
      );
      gravados++;
    }
    estado.done++;
  });
  return gravados;
}

/** Sincronização completa de um usuário. Ignora a chamada se já estiver rodando para ele. */
export async function sincronizar(user, log = console.log) {
  if (!user) throw new Error('Usuário do Last.fm não informado.');
  const estado = syncStateDe(user);
  if (estado.running) return { skipped: true };
  estado.running = true;
  estado.lastError = null;
  const [{ insertId }] = await db.query("INSERT INTO sync_log (started_at, status, lastfm_user) VALUES (NOW(), 'running', ?)", [user]);
  const resumo = { scrobbles: 0, durations: 0, genres: 0 };
  try {
    log(`[sync:${user}] buscando scrobbles novos…`);
    resumo.scrobbles = await sincronizarScrobbles(user, estado);
    log(`[sync:${user}] ${resumo.scrobbles} scrobbles novos`);
    resumo.durations = await sincronizarDuracoes(user, estado);
    log(`[sync:${user}] ${resumo.durations} durações gravadas`);
    resumo.genres = await sincronizarGeneros(user, estado);
    log(`[sync:${user}] ${resumo.genres} gêneros gravados`);
    await db.query(
      "UPDATE sync_log SET finished_at = NOW(), status = 'ok', new_scrobbles = ?, new_durations = ?, new_genres = ? WHERE id = ?",
      [resumo.scrobbles, resumo.durations, resumo.genres, insertId],
    );
    estado.lastSyncAt = new Date().toISOString();
    return resumo;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    estado.lastError = mensagem;
    log(`[sync:${user}] erro: ${mensagem}`);
    await db.query(
      "UPDATE sync_log SET finished_at = NOW(), status = 'error', message = ?, new_scrobbles = ? WHERE id = ?",
      [mensagem.slice(0, 1024), resumo.scrobbles, insertId],
    ).catch(() => {});
    throw erro;
  } finally {
    estado.running = false;
    estado.phase = 'idle';
    estado.done = 0;
    estado.total = 0;
  }
}

/** Data da última sincronização bem-sucedida de cada usuário (sobrevive a reinícios). */
export async function carregarUltimaSincronizacao() {
  const [linhas] = await db.query(
    "SELECT lastfm_user, MAX(finished_at) AS finished_at FROM sync_log WHERE status = 'ok' AND lastfm_user <> '' GROUP BY lastfm_user",
  );
  for (const linha of linhas) {
    if (linha.finished_at) syncStateDe(linha.lastfm_user).lastSyncAt = new Date(linha.finished_at).toISOString();
  }
}

/** Usuários que já têm histórico no banco (para a sincronização periódica). */
export async function usuariosConhecidos() {
  const [linhas] = await db.query("SELECT DISTINCT lastfm_user FROM scrobbles WHERE lastfm_user <> ''");
  return linhas.map((linha) => linha.lastfm_user);
}
