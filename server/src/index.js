import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import express from 'express';
import { config } from './config.js';
import { db, ensureSchema, getConnection } from './db.js';
import { carregarUltimaSincronizacao, sincronizar, syncState } from './sync.js';

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

/* ---------- API ---------- */
app.get('/api/status', async (_req, res) => {
  try {
    const [[contagem]] = await db.query(`SELECT
      (SELECT COUNT(*) FROM scrobbles) AS scrobbles,
      (SELECT COUNT(*) FROM track_durations) AS durations,
      (SELECT COUNT(*) FROM artist_genres) AS genres`);
    res.json({
      user: config.lastfm.user,
      scrobbles: Number(contagem.scrobbles),
      durations: Number(contagem.durations),
      genres: Number(contagem.genres),
      ...syncState,
    });
  } catch (erro) {
    res.status(500).json({ error: erro instanceof Error ? erro.message : 'Erro no banco' });
  }
});

app.post('/api/sync', (_req, res) => {
  if (syncState.running) return res.status(409).json({ message: 'Sincronização já em andamento.' });
  sincronizar().catch(() => {}); // roda em segundo plano; o erro fica em syncState.lastError
  res.status(202).json({ message: 'Sincronização iniciada.' });
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
      ORDER BY s.uts`, [fallback]).stream({ highWaterMark: 1000 });

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

const rodarSync = () => sincronizar().catch(() => {});
rodarSync();
setInterval(rodarSync, config.syncIntervalMinutes * 60_000);
