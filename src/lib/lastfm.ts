const BASE = "https://ws.audioscrobbler.com/2.0/";
const API_KEY = import.meta.env.VITE_LASTFM_API_KEY as string;
const USER = import.meta.env.VITE_LASTFM_USER as string;

const MESES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function validarConfiguracao() {
  if (!API_KEY) throw new Error('VITE_LASTFM_API_KEY não foi definida no arquivo .env.');
  if (!USER) throw new Error('VITE_LASTFM_USER não foi definido no arquivo .env.');
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

function formatarData(uts: number): string {
  const d = new Date(uts * 1000);
  return `${pad(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function buscarPagina(page: number, from?: number, signal?: AbortSignal) {
  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: USER,
    api_key: API_KEY,
    format: "json",
    limit: "200", // máximo permitido
    page: String(page),
  });
  if (from) params.set("from", String(from));

  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch(`${BASE}?${params}`, { signal });
    if (res.status === 429 || res.status >= 500) {
      await sleep(1000 * 2 ** tentativa);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    console.log('Resposta completa do Last.fm:', data);
    // A API às vezes devolve 200 com um erro no corpo; 8 e 29 valem nova tentativa
    if (data.error) {
      if ([8, 29].includes(data.error)) {
        await sleep(1000 * 2 ** tentativa);
        continue;
      }
      throw new Error(`Last.fm (${data.error}): ${data.message}`);
    }
    return data.recenttracks as {
      track: RawTrack[];
      "@attr": { totalPages: string; total: string };
    };
  }
  throw new Error("Falha após várias tentativas");
}

function obterMaiorImagem(images?: RawImage[]): string {
  return [...(images ?? [])].reverse().find((image) => image["#text"]?.trim())?.["#text"] ?? '';
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
  from?: number; // só scrobbles depois deste timestamp (sincronização)
  onProgress?: (feitas: number, total: number) => void;
  signal?: AbortSignal;
} = {}): Promise<Scrobble[]> {
  const { from, onProgress, signal } = opts;

  const primeira = await buscarPagina(1, from, signal);
  const totalPaginas = Number(primeira["@attr"].totalPages);
  const resultado = converter(primeira.track);
  onProgress?.(1, totalPaginas);

  // Páginas restantes em lotes de 4 requisições paralelas
  const LOTE = 4;
  for (let p = 2; p <= totalPaginas; p += LOTE) {
    const paginas = Array.from({ length: Math.min(LOTE, totalPaginas - p + 1) }, (_, i) => p + i);
    const respostas = await Promise.all(paginas.map((n) => buscarPagina(n, from, signal)));
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