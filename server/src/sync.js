import { db } from './db.js';
import { COLUNAS_SCROBBLE, duracaoFaixa, generoArtista, paginaRecentes } from './lastfm.js';

/** Estado em memória, exposto em /api/status. */
export const syncState = {
  running: false,
  phase: 'idle', // idle | scrobbles | durations | genres
  done: 0,
  total: 0,
  lastSyncAt: null,
  lastError: null,
};

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
 * 1) Scrobbles novos. As páginas são lidas da MAIS ANTIGA para a mais nova, com "to" fixo,
 *    e cada lote só é gravado quando inteiro. Assim, se a carga inicial for interrompida,
 *    a próxima continua de onde parou (a partir do MAX(uts) gravado) sem deixar buracos.
 */
async function sincronizarScrobbles() {
  const [[{ maxUts }]] = await db.query('SELECT MAX(uts) AS maxUts FROM scrobbles');
  const from = maxUts ? Number(maxUts) + 1 : undefined;
  const to = Math.floor(Date.now() / 1000);
  const primeira = await paginaRecentes(1, from, to);
  const totalPages = primeira.totalPages;
  syncState.phase = 'scrobbles';
  syncState.done = 0;
  syncState.total = totalPages;
  if (!totalPages) return 0;

  let novos = 0;
  const LOTE = 4;
  for (let fim = totalPages; fim >= 1; fim -= LOTE) {
    const paginas = [];
    for (let p = fim; p > Math.max(0, fim - LOTE); p--) paginas.push(p);
    const respostas = await Promise.all(paginas.map((p) => (p === 1 ? primeira : paginaRecentes(p, from, to))));
    const linhas = respostas.flatMap((resposta) => resposta.linhas);
    if (linhas.length) {
      const [resultado] = await db.query(`INSERT IGNORE INTO scrobbles (${COLUNAS_SCROBBLE.join(', ')}) VALUES ?`, [linhas]);
      novos += resultado.affectedRows;
    }
    syncState.done = totalPages - Math.max(0, fim - LOTE);
  }
  return novos;
}

/** 2) Duração de cada música ainda sem registro em track_durations. */
async function sincronizarDuracoes() {
  const [pendentes] = await db.query(`
    SELECT s.track_key, MIN(s.artist) AS artist, MIN(s.track) AS track
    FROM scrobbles s
    LEFT JOIN track_durations d ON d.track_key = s.track_key
    WHERE d.track_key IS NULL
    GROUP BY s.track_key`);
  syncState.phase = 'durations';
  syncState.done = 0;
  syncState.total = pendentes.length;
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
    syncState.done++;
  });
  return gravadas;
}

/** 3) Gênero (tag principal) de cada artista ainda sem registro em artist_genres. */
async function sincronizarGeneros() {
  const [pendentes] = await db.query(`
    SELECT s.artist_key, MIN(s.artist) AS artist
    FROM scrobbles s
    LEFT JOIN artist_genres g ON g.artist_key = s.artist_key
    WHERE g.artist_key IS NULL
    GROUP BY s.artist_key`);
  syncState.phase = 'genres';
  syncState.done = 0;
  syncState.total = pendentes.length;
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
    syncState.done++;
  });
  return gravados;
}

/** Sincronização completa. Ignora a chamada se outra já estiver rodando. */
export async function sincronizar(log = console.log) {
  if (syncState.running) return { skipped: true };
  syncState.running = true;
  syncState.lastError = null;
  const [{ insertId }] = await db.query("INSERT INTO sync_log (started_at, status) VALUES (NOW(), 'running')");
  const resumo = { scrobbles: 0, durations: 0, genres: 0 };
  try {
    log('[sync] buscando scrobbles novos…');
    resumo.scrobbles = await sincronizarScrobbles();
    log(`[sync] ${resumo.scrobbles} scrobbles novos`);
    resumo.durations = await sincronizarDuracoes();
    log(`[sync] ${resumo.durations} durações gravadas`);
    resumo.genres = await sincronizarGeneros();
    log(`[sync] ${resumo.genres} gêneros gravados`);
    await db.query(
      "UPDATE sync_log SET finished_at = NOW(), status = 'ok', new_scrobbles = ?, new_durations = ?, new_genres = ? WHERE id = ?",
      [resumo.scrobbles, resumo.durations, resumo.genres, insertId],
    );
    syncState.lastSyncAt = new Date().toISOString();
    return resumo;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    syncState.lastError = mensagem;
    log(`[sync] erro: ${mensagem}`);
    await db.query(
      "UPDATE sync_log SET finished_at = NOW(), status = 'error', message = ?, new_scrobbles = ? WHERE id = ?",
      [mensagem.slice(0, 1024), resumo.scrobbles, insertId],
    ).catch(() => {});
    throw erro;
  } finally {
    syncState.running = false;
    syncState.phase = 'idle';
    syncState.done = 0;
    syncState.total = 0;
  }
}

/** Data da última sincronização bem-sucedida gravada no banco (sobrevive a reinícios). */
export async function carregarUltimaSincronizacao() {
  const [[linha]] = await db.query("SELECT finished_at FROM sync_log WHERE status = 'ok' ORDER BY id DESC LIMIT 1");
  if (linha?.finished_at) syncState.lastSyncAt = new Date(linha.finished_at).toISOString();
}
