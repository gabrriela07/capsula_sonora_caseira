const BASE = "https://ws.audioscrobbler.com/2.0/";
const API_KEY = import.meta.env.VITE_LASTFM_API_KEY as string;
/** Usuário padrão do .env; a tela inicial permite trocar antes de conectar. */
export const LASTFM_ENV_USER = (import.meta.env.VITE_LASTFM_USER as string | undefined) ?? '';
const MESES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Imagem genérica (estrela cinza) que o Last.fm devolve quando não há capa real
const IMAGEM_PADRAO = "2a96cbd8b46e442fc41c2b86b821562f";

function validarConfiguracao(user: string) {
  if (!API_KEY) throw new Error('VITE_LASTFM_API_KEY não foi definida no arquivo .env.');
  if (!user) throw new Error('Informe o usuário do Last.fm.');
}

export interface Scrobble {
  artist: string;
  artist_mbid: string;
  album: string;
  album_mbid: string;
  track: string;
  track_mbid: string;
  image_url: string;
  lastfm_url: string;
  streamable: boolean;
  date_1: string; // "10 Jun 2026 19:55", mesmo formato do seu CSV
  uts: number;    // timestamp Unix, útil para sincronizar depois
}
interface RawImage {
  "#text": string;
  size: string;
}
interface RawTrack {
  name: string;
  artist: { "#text": string; mbid?: string };
  album: { "#text": string; mbid?: string };
  image?: RawImage[];
  mbid?: string;
  url?: string;
  streamable?: string;
  date?: { uts: string };
  "@attr"?: { nowplaying?: string };
}

class LastFmError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(`Last.fm (${code}): ${message}`);
    this.code = code;
  }
}

function formatarData(uts: number): string {
  const d = new Date(uts * 1000);
  return `${pad(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Chamada genérica com novas tentativas para erros temporários. */
async function requisitar(params: Record<string, string>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ ...params, api_key: API_KEY, format: "json" });
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch(`${BASE}?${query}`, { signal });
    if (res.status === 429 || res.status >= 500) {
      await sleep(1000 * 2 ** tentativa);
      continue;
    }
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!data) throw new Error(`HTTP ${res.status}`);
    // A API às vezes devolve 200 com um erro no corpo; 8, 11, 16 e 29 valem nova tentativa
    if (data.error) {
      const code = Number(data.error);
      if ([8, 11, 16, 29].includes(code)) {
        await sleep(1000 * 2 ** tentativa);
        continue;
      }
      throw new LastFmError(code, String(data.message ?? 'erro desconhecido'));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return data;
  }
  throw new Error("Falha após várias tentativas");
}

async function buscarPagina(user: string, page: number, from?: number, signal?: AbortSignal) {
  const params: Record<string, string> = {
    method: "user.getrecenttracks",
    user,
    limit: "200", // máximo permitido
    page: String(page),
  };
  if (from) params.from = String(from);
  const data = await requisitar(params, signal);
  return data.recenttracks as {
    track: RawTrack[];
    "@attr": { totalPages: string; total: string };
  };
}

function obterMaiorImagem(images?: RawImage[]): string {
  return [...(images ?? [])]
    .reverse()
    .find((image) => image["#text"]?.trim() && !image["#text"].includes(IMAGEM_PADRAO))?.["#text"] ?? '';
}

function converter(tracks: RawTrack[]): Scrobble[] {
  return tracks
    .filter((t) => t.date && !t["@attr"]?.nowplaying) // ignora "ouvindo agora"
    .map((t) => {
      const uts = Number(t.date!.uts);
      return {
        artist: t.artist["#text"],
        artist_mbid: t.artist.mbid ?? '',
        album: t.album["#text"],
        album_mbid: t.album.mbid ?? '',
        track: t.name,
        track_mbid: t.mbid ?? '',
        image_url: obterMaiorImagem(t.image),
        lastfm_url: t.url ?? '',
        streamable: t.streamable === '1',
        date_1: formatarData(uts),
        uts,
      };
    });
}

export async function baixarScrobbles(opts: {
  user: string;
  from?: number; // só scrobbles depois deste timestamp (sincronização)
  onProgress?: (feitas: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<Scrobble[]> {
  const { user, from, onProgress, signal } = opts;
  validarConfiguracao(user);
  const primeira = await buscarPagina(user, 1, from, signal);
  const totalPaginas = Math.max(1, Number(primeira["@attr"].totalPages));
  const resultado = converter(primeira.track);
  onProgress?.(1, totalPaginas);
  // Páginas restantes em lotes de 4 requisições paralelas
  const LOTE = 4;
  for (let p = 2; p <= totalPaginas; p += LOTE) {
    const paginas = Array.from({ length: Math.min(LOTE, totalPaginas - p + 1) }, (_, i) => p + i);
    const respostas = await Promise.all(paginas.map((n) => buscarPagina(user, n, from, signal)));
    respostas.forEach((r) => resultado.push(...converter(r.track)));
    onProgress?.(Math.min(p + LOTE - 1, totalPaginas), totalPaginas);
    await sleep(250); // respiro para não estourar o limite
  }
  // Se chegaram scrobbles novos durante o download, as páginas deslocam e podem duplicar
  const vistos = new Set<string>();
  return resultado.filter((s) => {
    const chave = `${s.uts}|${s.artist}|${s.track}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Enriquecimento: duração (track.getInfo) e gênero (artist.getTopTags) */
/* ------------------------------------------------------------------ */

const CACHE_DURACOES = 'capsula:lastfm:duracoes:v1';
const CACHE_GENEROS = 'capsula:lastfm:generos:v1';

function lerCache<T>(chave: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(chave) ?? '{}') as Record<string, T>; } catch { return {}; }
}
function salvarCache(chave: string, dados: Record<string, unknown>) {
  // Se a cota do localStorage acabar, segue sem cache em vez de quebrar a importação
  try { localStorage.setItem(chave, JSON.stringify(dados)); } catch { /* sem espaço */ }
}

export const chaveFaixa = (artist: string, track: string) => `${artist.trim().toLowerCase()}\u0001${track.trim().toLowerCase()}`;
export const chaveArtista = (artist: string) => artist.trim().toLowerCase();

interface OpcoesEnriquecimento {
  signal?: AbortSignal;
  onProgress?: (feitas: number, total: number) => void;
  /** Retorna true para encerrar a etapa e seguir com o que já foi obtido. */
  deveParar?: () => boolean;
}

/**
 * Executa as consultas em lotes. O Last.fm pede no máximo ~5 requisições/s,
 * então cada lote de 5 leva pelo menos 1 segundo.
 */
async function emLotes<T>(itens: T[], fn: (item: T) => Promise<void>, opts: OpcoesEnriquecimento, aoFimDoLote: () => void) {
  const LOTE = 5;
  for (let i = 0; i < itens.length; i += LOTE) {
    if (opts.signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    if (opts.deveParar?.()) break;
    const inicio = Date.now();
    await Promise.all(itens.slice(i, i + LOTE).map(fn));
    aoFimDoLote();
    opts.onProgress?.(Math.min(i + LOTE, itens.length), itens.length);
    const restante = 1000 - (Date.now() - inicio);
    if (restante > 0 && i + LOTE < itens.length) await sleep(restante);
  }
}

/** Duração cadastrada (ms) de cada faixa única. 0 = Last.fm não informa. */
export async function buscarDuracoes(faixas: Array<{ artist: string; track: string }>, opts: OpcoesEnriquecimento = {}): Promise<Map<string, number>> {
  const cache = lerCache<number>(CACHE_DURACOES);
  const resultado = new Map<string, number>();
  const pendentes: Array<{ artist: string; track: string; chave: string }> = [];
  for (const faixa of faixas) {
    const chave = chaveFaixa(faixa.artist, faixa.track);
    if (chave in cache) resultado.set(chave, cache[chave]);
    else pendentes.push({ ...faixa, chave });
  }
  opts.onProgress?.(faixas.length - pendentes.length, faixas.length);
  const jaEmCache = faixas.length - pendentes.length;
  let lotes = 0;
  await emLotes(pendentes, async ({ artist, track, chave }) => {
    try {
      const data = await requisitar({ method: 'track.getInfo', artist, track, autocorrect: '1' }, opts.signal);
      const ms = Number((data.track as { duration?: string } | undefined)?.duration ?? 0);
      cache[chave] = Number.isFinite(ms) ? ms : 0;
      resultado.set(chave, cache[chave]);
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') throw erro;
      // Faixa não encontrada (6) ou recurso inválido (7): guarda 0 para não consultar de novo
      if (erro instanceof LastFmError && [6, 7].includes(erro.code)) cache[chave] = 0;
      resultado.set(chave, 0);
    }
  }, { ...opts, onProgress: (feitas, total) => opts.onProgress?.(jaEmCache + feitas, jaEmCache + total) }, () => {
    if (++lotes % 10 === 0) salvarCache(CACHE_DURACOES, cache);
  });
  salvarCache(CACHE_DURACOES, cache);
  return resultado;
}

// Tags populares que não descrevem gênero musical
const TAGS_IGNORADAS = new Set([
  'seen live', 'favorites', 'favourites', 'favorite', 'favourite', 'my favorites', 'favs', 'fav', 'love', 'loved',
  'awesome', 'amazing', 'beautiful', 'cool', 'good', 'best', 'albums i own', 'spotify', 'vinyl', 'all', 'check out',
  'under 2000 listeners', 'male vocalists', 'female vocalists', 'male vocalist', 'female vocalist',
  'american', 'british', 'uk', 'usa', 'brazilian', 'brazil', 'brasil', 'german', 'french', 'japanese', 'korean',
  'swedish', 'canadian', 'australian', 'irish', 'english', 'spanish', 'italian',
]);

function escolherGenero(tags: Array<{ name?: string }>): string {
  for (const tag of tags) {
    const nome = String(tag.name ?? '').trim().toLowerCase();
    if (!nome || TAGS_IGNORADAS.has(nome)) continue;
    if (/^\d{2,4}s?$/.test(nome)) continue; // décadas e anos: 80s, 1999...
    return nome;
  }
  return '';
}

/** Tag principal (gênero) de cada artista. '' = sem tag útil. */
export async function buscarGeneros(artistas: string[], opts: OpcoesEnriquecimento = {}): Promise<Map<string, string>> {
  const cache = lerCache<string>(CACHE_GENEROS);
  const resultado = new Map<string, string>();
  const pendentes: Array<{ artist: string; chave: string }> = [];
  for (const artist of artistas) {
    const chave = chaveArtista(artist);
    if (chave in cache) resultado.set(chave, cache[chave]);
    else pendentes.push({ artist, chave });
  }
  const jaEmCache = artistas.length - pendentes.length;
  opts.onProgress?.(jaEmCache, artistas.length);
  let lotes = 0;
  await emLotes(pendentes, async ({ artist, chave }) => {
    try {
      const data = await requisitar({ method: 'artist.getTopTags', artist, autocorrect: '1' }, opts.signal);
      const tags = (data.toptags as { tag?: Array<{ name?: string }> } | undefined)?.tag ?? [];
      cache[chave] = escolherGenero(Array.isArray(tags) ? tags : [tags]);
      resultado.set(chave, cache[chave]);
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') throw erro;
      if (erro instanceof LastFmError && [6, 7].includes(erro.code)) cache[chave] = '';
      resultado.set(chave, '');
    }
  }, { ...opts, onProgress: (feitas, total) => opts.onProgress?.(jaEmCache + feitas, jaEmCache + total) }, () => {
    if (++lotes % 10 === 0) salvarCache(CACHE_GENEROS, cache);
  });
  salvarCache(CACHE_GENEROS, cache);
  return resultado;
}
