import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import express from 'express';
import { config, normalizarUsuario } from './config.js';
import { db, ensureSchema, getConnection } from './db.js';
import { verificarUsuario } from './lastfm.js';
import { carregarUltimaSincronizacao, sincronizar, syncStateDe, usuariosConhecidos } from './sync.js';

const app = express();
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const FALLBACK_DURATION_MS = 210_000;

/* ---------- Senha de acesso (HTTP Basic). Vazia = acesso livre. ---------- */
function senhaConfere(recebida) {
  const a = Buffer.from(recebida);
  const b = Buffer.from(config.appPassword);
  return a.length === b.length && timingSafeEqual(a, b);
}
app.use((req, res, next) => {
  if (!config.appPassword) return next();
  const [tipo, valor] = (req.headers.authorization ?? '').split(' ');
  if (tipo === 'Basic' && valor) {
    const texto = Buffer.from(valor, 'base64').toString('utf8');
    const senha = texto.slice(texto.indexOf(':') + 1);
    if (senhaConfere(senha)) return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Capsula Sonora", charset="UTF-8"');
  res.status(401).send('Acesso restrito');
});

/* ---------- Usuário do Last.fm (dinâmico) ---------- */

const USUARIO_VALIDO = /^[a-z0-9_-]{2,32}$/;
const verificados = new Map(); // user -> { ok, motivo, at }
const VALIDADE_VERIFICACAO_MS = 6 * 60 * 60_000;

/** Lê ?user=, o cabeçalho X-Lastfm-User ou, na falta deles, o LASTFM_USER padrão. */
function usuarioDaRequisicao(req) {
  const user = normalizarUsuario(req.query.user ?? req.headers['x-lastfm-user'] ?? config.lastfm.defaultUser);
  if (!user) return { erro: 'Informe o usuário do Last.fm (ex.: ?user=seu_usuario).', status: 400, needsUser: true };
  if (!USUARIO_VALIDO.test(user)) return { erro: 'Usuário do Last.fm inválido.', status: 400, needsUser: true };
  if (config.lastfm.allowedUsers.length && !config.lastfm.allowedUsers.includes(user)) {
    return { erro: 'Este usuário não está liberado nesta instalação.', status: 403, needsUser: true };
  }
  return { user };
}

async function totalScrobbles(user) {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM scrobbles WHERE lastfm_user = ?', [user]);
  return Number(total);
}

/** Confere no Last.fm (com cache) se o usuário existe e tem histórico público. */
async function usuarioExiste(user) {
  const cache = verificados.get(user);
  if (cache && Date.now() - cache.at < VALIDADE_VERIFICACAO_MS) return cache;
  const resultado = { ...(await verificarUsuario(user)), at: Date.now() };
  verificados.set(user, resultado);
  return resultado;
}

/** Garante que o usuário exista e dispara a primeira carga quando ainda não há histórico. */
async function prepararUsuario(user) {
  const total = await totalScrobbles(user);
  if (total > 0) return { ok: true, total };
  const verificacao = await usuarioExiste(user);
  if (!verificacao.ok) return verificacao;
  if (!syncStateDe(user).running) sincronizar(user).catch(() => {});
  return { ok: true, total };
}

/* ---------- API ---------- */

app.get('/api/config', (_req, res) => {
  res.json({ defaultUser: config.lastfm.defaultUser || null, restricted: config.lastfm.allowedUsers.length > 0 });
});

app.get('/api/status', async (req, res) => {
  const alvo = usuarioDaRequisicao(req);
  if (alvo.erro) return res.status(alvo.status).json({ error: alvo.erro, needsUser: alvo.needsUser });
  try {
    const preparo = await prepararUsuario(alvo.user);
    if (!preparo.ok) return res.status(404).json({ error: preparo.motivo, needsUser: true });
    const [[contagem]] = await db.query(`SELECT
      (SELECT COUNT(*) FROM scrobbles WHERE lastfm_user = ?) AS scrobbles,
      (SELECT COUNT(DISTINCT d.track_key) FROM scrobbles s JOIN track_durations d ON d.track_key = s.track_key WHERE s.lastfm_user = ?) AS durations,
      (SELECT COUNT(DISTINCT g.artist_key) FROM scrobbles s JOIN artist_genres g ON g.artist_key = s.artist_key WHERE s.lastfm_user = ?) AS genres`,
    [alvo.user, alvo.user, alvo.user]);
    res.json({
      user: alvo.user,
      scrobbles: Number(contagem.scrobbles),
      durations: Number(contagem.durations),
      genres: Number(contagem.genres),
      ...syncStateDe(alvo.user),
    });
  } catch (erro) {
    res.status(500).json({ error: erro instanceof Error ? erro.message : 'Erro no banco' });
  }
});

app.post('/api/sync', async (req, res) => {
  const alvo = usuarioDaRequisicao(req);
  if (alvo.erro) return res.status(alvo.status).json({ error: alvo.erro, needsUser: alvo.needsUser });
  try {
    const verificacao = await usuarioExiste(alvo.user);
    if (!verificacao.ok) return res.status(404).json({ error: verificacao.motivo, needsUser: true });
  } catch (erro) {
    return res.status(502).json({ error: erro instanceof Error ? erro.message : 'Falha ao consultar o Last.fm' });
  }
  if (syncStateDe(alvo.user).running) return res.status(409).json({ message: 'Sincronização já em andamento.' });
  sincronizar(alvo.user).catch(() => {}); // roda em segundo plano; o erro fica em lastError
  res.status(202).json({ message: 'Sincronização iniciada.', user: alvo.user });
});

/** Mediana das durações conhecidas: usada para músicas sem duração no Last.fm. */
async function duracaoMediana() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM track_durations WHERE duration_ms > 0');
  if (!Number(total)) return FALLBACK_DURATION_MS;
  const [[linha]] = await db.query(
    'SELECT duration_ms FROM track_durations WHERE duration_ms > 0 ORDER BY duration_ms LIMIT 1 OFFSET ?',
    [Math.floor(Number(total) / 2)],
  );
  return Number(linha?.duration_ms) || FALLBACK_DURATION_MS;
}

const COLUNAS_CSV = ['artist', 'artist_mbid', 'album', 'album_mbid', 'track', 'track_mbid', 'image_url', 'lastfm_url', 'streamable', 'date_1', 'uts', 'duration_ms', 'duration_estimated', 'genre'];
const celula = (valor) => {
  const texto = String(valor ?? '');
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/**
 * Histórico completo em CSV, no mesmo formato que o site já reconhece
 * (date_1 = '%d %b %Y %H:%M'). Enviado em streaming e compactado com gzip.
 */
app.get('/api/history.csv', async (req, res) => {
  const alvo = usuarioDaRequisicao(req);
  if (alvo.erro) return res.status(alvo.status).json({ error: alvo.erro, needsUser: alvo.needsUser });
  let conexao;
  try {
    const fallback = await duracaoMediana();
    conexao = await getConnection();
    await conexao.promise().query("SET SESSION lc_time_names = 'en_US'"); // %b em inglês: Jan, Feb…
    const linhas = conexao.query(`
      SELECT s.artist, s.artist_mbid, s.album, s.album_mbid, s.track, s.track_mbid, s.image_url, s.lastfm_url, s.streamable,
             DATE_FORMAT(s.played_at_local, '%d %b %Y %H:%i') AS date_1, s.uts,
             COALESCE(NULLIF(d.duration_ms, 0), ?) AS duration_ms, 1 AS duration_estimated,
             COALESCE(g.genre, '') AS genre
      FROM scrobbles s
      LEFT JOIN track_durations d ON d.track_key = s.track_key
      LEFT JOIN artist_genres g ON g.artist_key = s.artist_key
      WHERE s.lastfm_user = ?
      ORDER BY s.uts`, [fallback, alvo.user]).stream({ highWaterMark: 1000 });

    let cabecalhoEnviado = false;
    const paraCsv = new Transform({
      writableObjectMode: true,
      transform(linha, _encoding, callback) {
        const texto = COLUNAS_CSV.map((coluna) => celula(linha[coluna])).join(',') + '\n';
        if (!cabecalhoEnviado) { cabecalhoEnviado = true; return callback(null, `${COLUNAS_CSV.join(',')}\n${texto}`); }
        callback(null, texto);
      },
      flush(callback) {
        callback(null, cabecalhoEnviado ? '' : `${COLUNAS_CSV.join(',')}\n`);
      },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    if (gzip) {
      res.setHeader('Content-Encoding', 'gzip');
      await pipeline(linhas, paraCsv, createGzip({ level: 6 }), res);
    } else {
      await pipeline(linhas, paraCsv, res);
    }
  } catch (erro) {
    console.error('[history] erro:', erro);
    if (!res.headersSent) res.status(500).json({ error: erro instanceof Error ? erro.message : 'Erro ao exportar' });
    else res.destroy();
  } finally {
    conexao?.release();
  }
});

/* ---------- Site (pasta dist gerada por "npm run build" na raiz) ---------- */
if (existsSync(DIST)) {
  app.use(express.static(DIST, {
    setHeaders(res, caminho) {
      // Mesmos cabeçalhos do vite.config.ts
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      if (caminho.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.sendFile('index.html', { root: DIST });
  });
} else {
  console.warn('[site] pasta dist/ não encontrada. Rode "npm run build" na raiz do projeto para servir o painel.');
}

/* ---------- Inicialização ---------- */
await ensureSchema();
await carregarUltimaSincronizacao();
app.listen(config.port, '0.0.0.0', () => {
  console.log(`[servidor] Cápsula Sonora em http://localhost:${config.port}`);
});

/** Sincronização periódica: todos os usuários já carregados, um por vez. */
async function rodarSyncs() {
  const usuarios = [...new Set([config.lastfm.defaultUser, ...(await usuariosConhecidos())].filter(Boolean))];
  for (const user of usuarios) await sincronizar(user).catch(() => {});
}
rodarSyncs().catch(() => {});
setInterval(() => { rodarSyncs().catch(() => {}); }, config.syncIntervalMinutes * 60_000);
