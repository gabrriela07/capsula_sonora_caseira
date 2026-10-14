import { useEffect, useMemo, useState } from 'react';
import { Globe2, LoaderCircle, MapPin, Music2 } from 'lucide-react';
import type { RankedItem } from '../../types';
import { compactBR } from '../../lib/format';

type CountryPoint = { code: string; name: string; lon: number; lat: number };
type ResolvedArtist = { item: RankedItem; country: CountryPoint };

const COUNTRIES: Record<string, CountryPoint> = {
  US: { code: 'US', name: 'Estados Unidos', lon: -98, lat: 39 }, CA: { code: 'CA', name: 'Canadá', lon: -106, lat: 57 }, BR: { code: 'BR', name: 'Brasil', lon: -52, lat: -10 },
  MX: { code: 'MX', name: 'México', lon: -102, lat: 23 }, AR: { code: 'AR', name: 'Argentina', lon: -64, lat: -34 }, CL: { code: 'CL', name: 'Chile', lon: -71, lat: -33 },
  CO: { code: 'CO', name: 'Colômbia', lon: -74, lat: 4 }, PE: { code: 'PE', name: 'Peru', lon: -75, lat: -10 }, GB: { code: 'GB', name: 'Reino Unido', lon: -3, lat: 55 },
  IE: { code: 'IE', name: 'Irlanda', lon: -8, lat: 53 }, PT: { code: 'PT', name: 'Portugal', lon: -8, lat: 39 }, ES: { code: 'ES', name: 'Espanha', lon: -4, lat: 40 },
  FR: { code: 'FR', name: 'França', lon: 2, lat: 46 }, DE: { code: 'DE', name: 'Alemanha', lon: 10, lat: 51 }, IT: { code: 'IT', name: 'Itália', lon: 12, lat: 42 },
  NL: { code: 'NL', name: 'Países Baixos', lon: 5, lat: 52 }, BE: { code: 'BE', name: 'Bélgica', lon: 4, lat: 51 }, CH: { code: 'CH', name: 'Suíça', lon: 8, lat: 47 },
  AT: { code: 'AT', name: 'Áustria', lon: 14, lat: 47 }, SE: { code: 'SE', name: 'Suécia', lon: 15, lat: 62 }, NO: { code: 'NO', name: 'Noruega', lon: 9, lat: 62 },
  FI: { code: 'FI', name: 'Finlândia', lon: 26, lat: 64 }, DK: { code: 'DK', name: 'Dinamarca', lon: 10, lat: 56 }, IS: { code: 'IS', name: 'Islândia', lon: -19, lat: 65 },
  PL: { code: 'PL', name: 'Polônia', lon: 19, lat: 52 }, CZ: { code: 'CZ', name: 'Tchéquia', lon: 15, lat: 50 }, GR: { code: 'GR', name: 'Grécia', lon: 22, lat: 39 },
  TR: { code: 'TR', name: 'Turquia', lon: 35, lat: 39 }, UA: { code: 'UA', name: 'Ucrânia', lon: 31, lat: 49 }, RU: { code: 'RU', name: 'Rússia', lon: 90, lat: 60 },
  ZA: { code: 'ZA', name: 'África do Sul', lon: 24, lat: -29 }, NG: { code: 'NG', name: 'Nigéria', lon: 8, lat: 9 }, GH: { code: 'GH', name: 'Gana', lon: -1, lat: 8 },
  IN: { code: 'IN', name: 'Índia', lon: 79, lat: 22 }, CN: { code: 'CN', name: 'China', lon: 104, lat: 35 }, JP: { code: 'JP', name: 'Japão', lon: 138, lat: 37 },
  KR: { code: 'KR', name: 'Coreia do Sul', lon: 128, lat: 36 }, AU: { code: 'AU', name: 'Austrália', lon: 134, lat: -25 }, NZ: { code: 'NZ', name: 'Nova Zelândia', lon: 172, lat: -41 },
};

const x = (lon: number) => (lon + 180) / 360 * 1000;
const y = (lat: number) => (90 - lat) / 180 * 500;
const cacheKey = (item: RankedItem) => `capsula:artist-country:${item.mbid || item.name.toLocaleLowerCase()}`;

async function resolveCountry(item: RankedItem, signal: AbortSignal): Promise<CountryPoint | null> {
  const cached = localStorage.getItem(cacheKey(item));
  if (cached) return cached === '-' ? null : COUNTRIES[cached] ?? null;

  const url = item.mbid
    ? `https://musicbrainz.org/ws/2/artist/${encodeURIComponent(item.mbid)}?fmt=json`
    : `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${item.name}"`)}&fmt=json&limit=1`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`MusicBrainz ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  const artist = item.mbid ? payload : ((payload.artists as Array<Record<string, unknown>> | undefined)?.[0] ?? {});
  const area = artist.area as { 'iso-3166-1-codes'?: string[] } | undefined;
  const beginArea = artist['begin-area'] as { 'iso-3166-1-codes'?: string[] } | undefined;
  const code = String((area?.['iso-3166-1-codes']?.[0] ?? beginArea?.['iso-3166-1-codes']?.[0] ?? artist.country ?? '')).toUpperCase();
  const country = COUNTRIES[code] ?? null;
  localStorage.setItem(cacheKey(item), country?.code ?? '-');
  return country;
}

export function ArtistMap({ artists }: { artists: RankedItem[] }) {
  const [resolved, setResolved] = useState<ResolvedArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const sourceKey = artists.slice(0, 10).map((artist) => `${artist.mbid || artist.name}:${artist.plays}`).join('|');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setResolved([]);
    setFailed(false);
    setLoading(true);

    void (async () => {
      const next: ResolvedArtist[] = [];
      try {
        for (const item of artists.slice(0, 10)) {
          if (controller.signal.aborted) break;
          try {
            const country = await resolveCountry(item, controller.signal);
            if (country) next.push({ item, country });
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') break;
          }
          if (!cancelled) setResolved([...next]);
          await new Promise((resolve) => setTimeout(resolve, 1050));
        }
        if (!cancelled) setFailed(next.length === 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [sourceKey]);

  const groups = useMemo(() => {
    const byCountry = new Map<string, { country: CountryPoint; artists: RankedItem[]; plays: number; value: number }>();
    resolved.forEach(({ item, country }) => {
      const group = byCountry.get(country.code) ?? { country, artists: [], plays: 0, value: 0 };
      group.artists.push(item);
      group.plays += item.plays;
      group.value += item.value;
      byCountry.set(country.code, group);
    });
    return [...byCountry.values()].sort((a, b) => b.plays - a.plays);
  }, [resolved]);

  const active = groups.find((group) => group.country.code === activeCode) ?? groups[0];
  const maxPlays = Math.max(...groups.map((group) => group.plays), 1);

  return <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-carbon/55">
    <div className="map-grid relative min-h-[410px] overflow-hidden">
      <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full" role="img" aria-label="Mapa de origem dos artistas mais ouvidos">
        <defs><linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#3f3f46" /><stop offset="1" stopColor="#27272a" /></linearGradient><filter id="dotGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g fill="url(#land)" stroke="rgba(255,255,255,.08)" strokeWidth="1.5">
          <path d="M52 114 L115 73 205 68 282 101 307 149 267 186 228 178 202 212 162 205 133 168 89 158 Z" />
          <path d="M250 220 L300 233 328 286 317 357 285 433 249 397 230 322 226 263 Z" />
          <path d="M441 99 L497 72 548 91 568 126 539 151 504 146 482 176 447 160 420 131 Z" />
          <path d="M493 179 L557 172 600 222 590 310 551 389 505 350 477 271 Z" />
          <path d="M550 98 L651 63 786 78 879 116 930 171 873 204 794 182 737 220 663 197 613 157 560 151 Z" />
          <path d="M786 299 L853 278 912 311 900 369 838 386 790 349 Z" />
          <path d="M921 402 L943 393 958 416 940 438 Z" />
        </g>
        {groups.map((group) => {
          const radius = 8 + Math.sqrt(group.plays / maxPlays) * 13;
          const activePoint = active?.country.code === group.country.code;
          return <g key={group.country.code} className="cursor-pointer" onMouseEnter={() => setActiveCode(group.country.code)} onFocus={() => setActiveCode(group.country.code)} tabIndex={0} role="button" aria-label={`${group.country.name}: ${group.artists.length} artistas`}>
            <circle cx={x(group.country.lon)} cy={y(group.country.lat)} r={radius + 9} fill="rgba(163,230,53,.12)" className="animate-pulse" />
            <circle cx={x(group.country.lon)} cy={y(group.country.lat)} r={radius} fill={activePoint ? '#FAEE66' : '#A3E635'} stroke="#171717" strokeWidth="4" filter="url(#dotGlow)" />
            <text x={x(group.country.lon)} y={y(group.country.lat) + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#171717">{group.artists.length}</text>
          </g>;
        })}
      </svg>

      <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-white"><Globe2 className="h-4 w-4 text-slime" /> Origem dos artistas</div>
        <p className="mt-1 max-w-[230px] text-[10px] leading-relaxed text-zinc-400">País estimado para os 10 artistas líderes via MusicBrainz.</p>
      </div>

      {active && <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-[#222224]/95 p-4 shadow-2xl backdrop-blur-xl sm:left-auto sm:w-[310px]">
        <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[.14em] text-slime"><MapPin className="h-3.5 w-3.5" />{active.country.name}</p><p className="mt-1 text-2xl font-black text-white">{active.artists.length} {active.artists.length === 1 ? 'artista' : 'artistas'}</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-300">{compactBR.format(active.plays)} plays</span></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{active.artists.map((artist) => <span key={artist.name} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">{artist.name}</span>)}</div>
      </div>}

      {loading && <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[11px] font-semibold text-zinc-300 backdrop-blur"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-slime" /> Localizando {Math.min(resolved.length + 1, Math.min(artists.length, 10))}/{Math.min(artists.length, 10)}</div>}
      {failed && !loading && <div className="absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-white/10 bg-[#222224]/95 p-5 text-center shadow-2xl"><Music2 className="mx-auto h-6 w-6 text-zinc-500" /><p className="mt-2 text-sm font-bold text-white">Origem não localizada</p><p className="mt-1 text-xs leading-relaxed text-zinc-500">O mapa depende dos MBIDs ou nomes dos artistas e de acesso ao MusicBrainz. Os demais gráficos continuam funcionando normalmente.</p></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[10px] text-zinc-500"><span>Círculo maior = mais reproduções entre os artistas localizados</span><span>{resolved.length}/{Math.min(artists.length, 10)} artistas localizados</span></div>
  </div>;
}
