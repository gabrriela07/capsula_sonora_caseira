import type { RankedItem } from '../types';

export type ArtworkKind = 'artist' | 'album' | 'track';

type LastFmImage = { '#text'?: string; size?: string };

const PLACEHOLDER_MARKERS = ['2a96cbd8b46e442fc41c2b86b821562f', 'default_album_medium', 'noimage'];
const memory = new Map<string, Promise<string>>();
let musicBrainzQueue: Promise<unknown> = Promise.resolve();
let lastMusicBrainzRequest = 0;

function keyFor(item: RankedItem, kind: ArtworkKind) {
  return [kind, item.artist ?? '', item.name, item.mbid ?? ''].join('|').toLocaleLowerCase();
}

function usable(url?: string | null): url is string {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const lower = url.toLocaleLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

function imagesFrom(payload: unknown): LastFmImage[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.image)) return record.image as LastFmImage[];
  for (const value of Object.values(record)) {
    const found = imagesFrom(value);
    if (found.length) return found;
  }
  return [];
}

function bestImage(payload: unknown): string | null {
  const candidates = imagesFrom(payload).map((image) => image['#text'] ?? '').filter(usable);
  return candidates.at(-1) ?? null;
}

async function json(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

async function lastFmArtwork(item: RankedItem, kind: ArtworkKind): Promise<string | null> {
  const apiKey = String(import.meta.env.VITE_LASTFM_API_KEY ?? '').trim();
  if (!apiKey) return null;
  const params = new URLSearchParams({ api_key: apiKey, format: 'json', autocorrect: '1' });
  const artist = kind === 'artist' ? item.name : item.artist ?? '';
  if (!artist) return null;
  params.set('artist', artist);
  if (kind === 'artist') {
    params.set('method', 'artist.getTopAlbums');
    params.set('limit', '1');
  } else if (kind === 'album') {
    params.set('method', 'album.getInfo');
    params.set('album', item.name);
  } else {
    params.set('method', 'track.getInfo');
    params.set('track', item.name);
  }
  try {
    return bestImage(await json(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`));
  } catch {
    return null;
  }
}

async function musicBrainzJson(url: string): Promise<Record<string, unknown>> {
  const task = musicBrainzQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastMusicBrainzRequest));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastMusicBrainzRequest = Date.now();
    return json(url);
  });
  musicBrainzQueue = task.catch(() => undefined);
  return task;
}

function coverArt(groupId: string) {
  return `https://coverartarchive.org/release-group/${encodeURIComponent(groupId)}/front-500`;
}

async function musicBrainzArtwork(item: RankedItem, kind: ArtworkKind): Promise<string | null> {
  try {
    if (kind === 'album' && item.mbid) {
      // Alguns históricos trazem release-group; outros, release. Detecta os dois formatos.
      try {
        await musicBrainzJson(`https://musicbrainz.org/ws/2/release-group/${encodeURIComponent(item.mbid)}?fmt=json`);
        return coverArt(item.mbid);
      } catch {
        const release = await musicBrainzJson(`https://musicbrainz.org/ws/2/release/${encodeURIComponent(item.mbid)}?inc=release-groups&fmt=json`);
        const group = release['release-group'] as Record<string, unknown> | undefined;
        const groupId = String(group?.id ?? '');
        if (groupId) return coverArt(groupId);
      }
    }

    if (kind === 'artist') {
      let artistId = item.mbid;
      if (!artistId) {
        const result = await musicBrainzJson(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${item.name}"`)}&fmt=json&limit=1`);
        artistId = String((result.artists as Array<Record<string, unknown>> | undefined)?.[0]?.id ?? '');
      }
      if (!artistId) return null;
      const result = await musicBrainzJson(`https://musicbrainz.org/ws/2/release-group?artist=${encodeURIComponent(artistId)}&type=album&fmt=json&limit=1`);
      const groupId = String((result['release-groups'] as Array<Record<string, unknown>> | undefined)?.[0]?.id ?? '');
      return groupId ? coverArt(groupId) : null;
    }

    const artist = item.artist ?? '';
    const query = kind === 'album'
      ? `releasegroup:"${item.name}" AND artist:"${artist}"`
      : `recording:"${item.name}" AND artist:"${artist}"`;
    const endpoint = kind === 'album' ? 'release-group' : 'recording';
    const result = await musicBrainzJson(`https://musicbrainz.org/ws/2/${endpoint}?query=${encodeURIComponent(query)}&fmt=json&limit=1`);
    if (kind === 'album') {
      const groupId = String((result['release-groups'] as Array<Record<string, unknown>> | undefined)?.[0]?.id ?? '');
      return groupId ? coverArt(groupId) : null;
    }
    const recording = (result.recordings as Array<Record<string, unknown>> | undefined)?.[0];
    const releases = recording?.releases as Array<Record<string, unknown>> | undefined;
    const group = releases?.[0]?.['release-group'] as Record<string, unknown> | undefined;
    const groupId = String(group?.id ?? '');
    return groupId ? coverArt(groupId) : null;
  } catch {
    return null;
  }
}

async function inlineWhenPossible(url: string): Promise<string> {
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) return url;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return url;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export function fallbackArtwork(label: string, kind: ArtworkKind): string {
  const palettes: Record<ArtworkKind, [string, string]> = {
    artist: ['#D162A4', '#44233a'],
    album: ['#A3E635', '#29410f'],
    track: ['#FAEE66', '#514c13'],
  };
  const [first, second] = palettes[kind];
  const initial = (label.trim()[0] || '♪').toLocaleUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${first}"/><stop offset="1" stop-color="${second}"/></linearGradient><filter id="n"><feTurbulence baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .18 0"/></filter></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="470" cy="120" r="170" fill="none" stroke="white" stroke-opacity=".13" stroke-width="44"/><rect width="600" height="600" filter="url(#n)" opacity=".28"/><text x="300" y="365" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="240" font-weight="900" fill="#fff" fill-opacity=".84">${initial.replace(/[<>&]/g, '')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function resolveArtwork(item: RankedItem, kind: ArtworkKind): Promise<string> {
  const key = keyFor(item, kind);
  const existing = memory.get(key);
  if (existing) return existing;
  const task = (async () => {
    if (usable(item.imageUrl)) return inlineWhenPossible(item.imageUrl);
    const stored = localStorage.getItem(`capsula:artwork:v2:${key}`);
    if (usable(stored)) return inlineWhenPossible(stored);
    const remote = await lastFmArtwork(item, kind) ?? await musicBrainzArtwork(item, kind);
    if (usable(remote)) {
      localStorage.setItem(`capsula:artwork:v2:${key}`, remote);
      return inlineWhenPossible(remote);
    }
    return fallbackArtwork(item.name, kind);
  })();
  memory.set(key, task);
  return task;
}

/** Segunda fonte usada quando a URL principal existe, mas o navegador não consegue exibi-la. */
export async function resolveBackupArtwork(item: RankedItem, kind: ArtworkKind): Promise<string> {
  const remote = await musicBrainzArtwork(item, kind);
  return usable(remote) ? inlineWhenPossible(remote) : fallbackArtwork(item.name, kind);
}
