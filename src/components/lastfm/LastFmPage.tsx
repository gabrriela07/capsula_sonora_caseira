import { useRef, useState } from 'react';
import { Disc3, Download, ExternalLink, Headphones, LoaderCircle, Music2, Play, Radio, Sparkles, TimerReset, UserRound } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { DashboardData, Filters, RankedItem } from '../../types';
import { capsulePeriod, compactBR, formatDuration, safeFileName } from '../../lib/format';
import { ArtworkImage } from '../media/ArtworkImage';
import type { ArtworkKind } from '../../lib/artwork';

const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+S2nqWQAAAABJRU5ErkJggg==';

function ArtworkCard({ item, rank, kind, large = false }: { item: RankedItem; rank: number; kind: ArtworkKind; large?: boolean }) {
  const value = `${compactBR.format(item.plays)} reproduções`;
  return <a
    href={item.lastFmUrl || undefined}
    target={item.lastFmUrl ? '_blank' : undefined}
    rel="noopener noreferrer"
    className={`image-mosaic-card group relative block h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-petal/40 via-graphite to-slime/25 ${large ? 'min-h-[310px]' : 'min-h-[210px]'} ${item.lastFmUrl ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <ArtworkImage item={item} kind={kind} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
    <span className="absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-extrabold tracking-[.14em] text-white backdrop-blur">#{rank}</span>
    {item.lastFmUrl && <ExternalLink className="absolute right-4 top-4 z-10 h-4 w-4 text-white/70 opacity-0 transition group-hover:opacity-100" />}
    <div className="absolute inset-x-0 bottom-0 z-10 p-5">
      <p className={`${large ? 'text-2xl' : 'text-lg'} line-clamp-2 font-black leading-tight text-white drop-shadow`}>{item.name}</p>
      {item.artist && <p className="mt-1 truncate text-xs font-semibold text-white/70">{item.artist}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slime"><Play className="h-3.5 w-3.5 fill-current" />{value}</p>
    </div>
  </a>;
}

export function LastFmPage({ data, filters, hasDuration }: { data: DashboardData; filters: Filters; hasDuration: boolean }) {
  const pageRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const period = capsulePeriod(filters);
  const artists = data.topArtists.slice(0, 6);
  const albums = data.topAlbums.slice(0, 6);
  const tracks = data.topTracks.slice(0, 10);

  async function exportPage() {
    if (!pageRef.current || exporting) return;
    setExporting(true);
    setExportStatus('');
    try {
      const element = pageRef.current;
      const dataUrl = await toPng(element, {
        backgroundColor: '#171717',
        cacheBust: true,
        pixelRatio: Math.min(1.6, Math.max(1, 1800 / Math.max(element.scrollWidth, 1))),
        width: element.scrollWidth,
        height: element.scrollHeight,
        imagePlaceholder: TRANSPARENT_PIXEL,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportExclude === 'true'),
      });
      const link = document.createElement('a');
      link.download = `lastfm-one-page-${safeFileName(period)}.png`;
      link.href = dataUrl;
      link.click();
      setExportStatus('Imagem da página inteira gerada.');
    } catch {
      setExportStatus('Não foi possível gerar a imagem neste navegador.');
    } finally {
      setExporting(false);
    }
  }

  return <section ref={pageRef} className="space-y-8 animate-fade-up">
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#d92323] px-4 py-3 shadow-[0_14px_40px_rgba(217,35,35,.14)] md:px-5">
      <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full border-[28px] border-white/10" />
      <div className="relative z-10 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm font-black text-white"><Play className="h-4 w-4 fill-current" />{compactBR.format(data.kpis.plays)} <small className="font-semibold text-white/65">plays</small></span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm font-black text-white"><UserRound className="h-4 w-4" />{compactBR.format(data.kpis.artists)} <small className="font-semibold text-white/65">artistas</small></span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm font-black text-white"><Music2 className="h-4 w-4" />{compactBR.format(data.kpis.tracks)} <small className="font-semibold text-white/65">faixas</small></span>
        {hasDuration && <span className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm font-black text-white"><Headphones className="h-4 w-4" />{formatDuration(data.kpis.totalMs)}</span>}
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm font-black text-white"><TimerReset className="h-4 w-4" />{data.kpis.longestStreak} <small className="font-semibold text-white/65">dias seguidos</small></span>
        <button data-export-exclude="true" type="button" onClick={() => void exportPage()} disabled={exporting} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white px-3 py-2 text-sm font-extrabold text-[#b71919] shadow-sm transition hover:-translate-y-0.5 hover:bg-white/90 disabled:cursor-wait disabled:opacity-70">{exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Gerar imagem</button>
      </div>
      {exportStatus && <p data-export-exclude="true" className="relative z-10 mt-2 text-right text-[10px] font-semibold text-white/75">{exportStatus}</p>}
    </div>

    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-petal">Top performers</p><h3 className="mt-1 text-3xl font-black tracking-tight">Artistas principais</h3></div>
        <UserRound className="h-8 w-8 text-white/10" />
      </div>
      {artists.length > 0 ? <div className="grid auto-rows-[210px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {artists.map((item, index) => <div key={`${item.name}-${index}`} className={`${index === 0 ? 'sm:row-span-2 lg:col-span-2' : index === 1 ? 'lg:col-span-2' : ''}`}><ArtworkCard item={item} rank={index + 1} kind="artist" large={index === 0} /></div>)}
      </div> : <div className="panel text-sm text-zinc-500">Nenhum artista disponível neste recorte.</div>}
    </div>

    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-slime">On repeat</p><h3 className="mt-1 text-3xl font-black tracking-tight">Álbuns principais</h3></div>
        <Disc3 className="h-8 w-8 text-white/10" />
      </div>
      {albums.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((item, index) => <ArtworkCard key={`${item.name}-${item.artist ?? ''}`} item={item} rank={index + 1} kind="album" />)}
      </div> : <div className="panel text-sm text-zinc-500">Nenhum álbum disponível neste recorte.</div>}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <article className="panel overflow-hidden p-0 md:p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-6"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-banana">Faixas em destaque</p><h3 className="mt-1 text-2xl font-black">Mais ouvidas</h3></div><Music2 className="h-7 w-7 text-banana" /></div>
        <ol className="divide-y divide-white/5">
          {tracks.map((track, index) => <li key={`${track.name}-${track.artist ?? ''}`} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.04] md:px-6">
            <span className="w-6 text-sm font-black text-zinc-600 group-hover:text-slime">{String(index + 1).padStart(2, '0')}</span>
            <ArtworkImage item={track} kind="track" alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{track.name}</p><p className="truncate text-xs text-zinc-500">{track.artist}</p></div>
            <span className="shrink-0 text-xs font-bold text-zinc-400">{compactBR.format(track.plays)} plays</span>
          </li>)}
        </ol>
      </article>

      <aside className="panel flex flex-col justify-between overflow-hidden bg-gradient-to-br from-graphite via-graphite to-petal/10">
        <div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-zinc-500"><Radio className="h-4 w-4" />{period}</p><p className="mt-2 text-3xl font-black leading-tight">A trilha que definiu o recorte.</p></div>
        <div className="my-8 space-y-3">
          <div className="rounded-2xl bg-carbon/60 p-4"><Play className="mb-3 h-5 w-5 text-slime" /><p className="text-3xl font-black text-white">{compactBR.format(data.kpis.plays)}</p><p className="text-xs text-zinc-500">reproduções registradas</p></div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-carbon/60 p-4"><UserRound className="mb-3 h-5 w-5 text-petal" /><p className="text-2xl font-black text-white">{compactBR.format(data.kpis.artists)}</p><p className="text-xs text-zinc-500">artistas</p></div><div className="rounded-2xl bg-carbon/60 p-4"><Sparkles className="mb-3 h-5 w-5 text-banana" /><p className="text-2xl font-black text-white">{data.discovery.reduce((sum, point) => sum + point.count, 0)}</p><p className="text-xs text-zinc-500">descobertas</p></div></div>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">As artes tentam primeiro a URL do histórico e, quando ela falta, consultam Last.fm/MusicBrainz com cache local e fallback visual.</p>
      </aside>
    </div>
  </section>;
}
