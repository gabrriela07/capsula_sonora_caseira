import { createHash } from 'node:crypto';
import { config } from './config.js';

const BASE = 'https://ws.audioscrobbler.com/2.0/';
// Imagem genérica (estrela cinza) que o Last.fm devolve quando não há capa real
const IMAGEM_PADRAO = '2a96cbd8b46e442fc41c2b86b821562f';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class LastFmError extends Error {
  constructor(code, message) {
    super(`Last.fm (${code}): ${message}`);
    this.code = code;
  }
}

/* O Last.fm pede no máximo ~5 requisições por segundo por chave.
   Este controle espaça o início de todas as chamadas do processo. */
const INTERVALO_MS = 220;
let proximaJanela = 0;
async function aguardarVez() {
  const agora = Date.now();
  const espera = Math.max(0, proximaJanela - agora);
  proximaJanela = Math.max(agora, proximaJanela) + INTERVALO_MS;
  if (espera) await sleep(espera);
}

async function requisitar(params) {
  const query = new URLSearchParams({ ...params, api_key: config.lastfm.apiKey, format: 'json' });
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    await aguardarVez();
    let res;
    try {
      res = await fetch(`${BASE}?${query}`, { signal: AbortSignal.timeout(20_000) });
    } catch {
      await sleep(1000 * 2 ** tentativa); // rede instável / timeout
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(1000 * 2 ** tentativa);
      continue;
    }
    const data = await res.json().catch(() => null);
    if (!data) throw new Error(`HTTP ${res.status}`);
    if (data.error) {
      const code = Number(data.error);
      if ([8, 11, 16, 29].includes(code)) { await sleep(1000 * 2 ** tentativa); continue; }
      throw new LastFmError(code, String(data.message ?? 'erro desconhecido'));
    }
    return data;
  }
  throw new Error('Last.fm: falha após várias tentativas');
}

const sha1 = (text) => createHash('sha1').update(text).digest('hex');
export const chaveFaixa = (artist, track) => sha1(`${artist.trim().toLowerCase()}\u0001${track.trim().toLowerCase()}`);
export const chaveArtista = (artist) => sha1(artist.trim().toLowerCase());
const corta = (text, max) => String(text ?? '').slice(0, max);
const lista = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const formatoLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timeZone,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
/** "YYYY-MM-DD HH:MM:SS" no fuso configurado (TZ_LOCAL). */
function dataLocal(uts) {
  const p = Object.fromEntries(formatoLocal.formatToParts(new Date(uts * 1000)).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function maiorImagem(images) {
  return [...lista(images)].reverse()
    .find((image) => image['#text']?.trim() && !image['#text'].includes(IMAGEM_PADRAO))?.['#text'] ?? '';
}

/** Converte a resposta do user.getRecentTracks em linhas da tabela scrobbles. */
function converter(tracks) {
  return lista(tracks)
    .filter((t) => t.date && !t['@attr']?.nowplaying) // ignora "ouvindo agora"
    .map((t) => {
      const uts = Number(t.date.uts);
      const artist = corta(t.artist?.['#text'], 512);
      const track = corta(t.name, 512);
      return [
        sha1(`${uts}|${artist}|${track}`),
        uts,
        dataLocal(uts),
        artist,
        corta(t.artist?.mbid, 64),
        corta(t.album?.['#text'], 512),
        corta(t.album?.mbid, 64),
        track,
        corta(t.mbid, 64),
        corta(maiorImagem(t.image), 1024),
        corta(t.url, 1024),
        t.streamable === '1' ? 1 : 0,
        chaveFaixa(artist, track),
        chaveArtista(artist),
      ];
    })
    .filter((row) => row[3] && row[7]);
}

export const COLUNAS_SCROBBLE = [
  'scrobble_key', 'uts', 'played_at_local', 'artist', 'artist_mbid', 'album', 'album_mbid',
  'track', 'track_mbid', 'image_url', 'lastfm_url', 'streamable', 'track_key', 'artist_key',
];

/** Uma página do histórico (200 itens) dentro da janela from–to. */
export async function paginaRecentes(page, from, to) {
  const params = { method: 'user.getrecenttracks', user: config.lastfm.user, limit: '200', page: String(page), to: String(to) };
  if (from) params.from = String(from);
  const data = await requisitar(params);
  const bloco = data.recenttracks ?? {};
  return { totalPages: Number(bloco['@attr']?.totalPages ?? 0), linhas: converter(bloco.track) };
}

/** Duração cadastrada (ms). null = falha temporária (tentar na próxima sincronização). */
export async function duracaoFaixa(artist, track) {
  try {
    const data = await requisitar({ method: 'track.getInfo', artist, track, autocorrect: '1' });
    const ms = Number(data.track?.duration ?? 0);
    return Number.isFinite(ms) ? ms : 0;
  } catch (erro) {
    if (erro instanceof LastFmError && [6, 7].includes(erro.code)) return 0; // não encontrada
    return null;
  }
}

// Tags populares que não descrevem gênero musical
const TAGS_IGNORADAS = new Set([
  'seen live', 'favorites', 'favourites', 'favorite', 'favourite', 'my favorites', 'favs', 'fav', 'love', 'loved',
  'awesome', 'amazing', 'beautiful', 'cool', 'good', 'best', 'albums i own', 'spotify', 'vinyl', 'all', 'check out',
  'under 2000 listeners', 'male vocalists', 'female vocalists', 'male vocalist', 'female vocalist',
  'american', 'british', 'uk', 'usa', 'brazilian', 'brazil', 'brasil', 'german', 'french', 'japanese', 'korean',
  'swedish', 'canadian', 'australian', 'irish', 'english', 'spanish', 'italian',
]);

/** Tag principal do artista. '' = sem tag útil; null = falha temporária. */
export async function generoArtista(artist) {
  try {
    const data = await requisitar({ method: 'artist.getTopTags', artist, autocorrect: '1' });
    for (const tag of lista(data.toptags?.tag)) {
      const nome = String(tag.name ?? '').trim().toLowerCase();
      if (!nome || TAGS_IGNORADAS.has(nome) || /^\d{2,4}s?$/.test(nome)) continue;
      return nome.slice(0, 128);
    }
    return '';
  } catch (erro) {
    if (erro instanceof LastFmError && [6, 7].includes(erro.code)) return '';
    return null;
  }
}
