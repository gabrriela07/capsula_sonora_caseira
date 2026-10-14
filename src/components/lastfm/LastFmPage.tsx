import { Disc3, ExternalLink, Headphones, Music2, Play, Radio, UserRound } from 'lucide-react';
import type { DashboardData, Filters, RankedItem } from '../../types';
import { capsulePeriod, compactBR, formatDuration } from '../../lib/format';

function ArtworkCard({ item, rank, large = false }: { item: RankedItem; rank: number; large?: boolean }) {
  const value = `${compactBR.format(item.plays)} reproduções`;
  return <a
    href={item.lastFmUrl || undefined}
    target={item.lastFmUrl ? '_blank' : undefined}
    rel="noopener noreferrer"
    className={`image-mosaic-card group relative block h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-petal/40 via-graphite to-slime/25 ${large ? 'min-h-[310px]' : 'min-h-[210px]'} ${item.lastFmUrl ? 'cursor-pointer' : 'cursor-default'}`}
  >
    {item.imageUrl
      ? <img src={item.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
      : <div className="absolute inset-0 flex items-center justify-center text-7xl font-black text-white/10">{item.name.slice(0, 1).toUpperCase()}</div>}
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
  const period = capsulePeriod(filters);
  const artists = data.topArtists.slice(0, 6);
  const albums = data.topAlbums.slice(0, 6);
  const tracks = data.topTracks.slice(0, 10);

  return <section className="space-y-8 animate-fade-up">
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#d92323] px-6 py-10 shadow-[0_25px_80px_rgba(217,35,35,.18)] md:px-10 md:py-14">
      <div className="absolute -right-12 -top-16 h-72 w-72 rounded-full border-[50px] border-white/10" />
      <div className="absolute bottom-0 right-16 h-32 w-32 rounded-full bg-black/10 blur-2xl" />
      <div className="relative z-10 max-w-3xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.18em] text-white"><Radio className="h-4 w-4" /> Last.fm one page</div>
        <h2 className="text-4xl font-black leading-[.95] tracking-[-.05em] text-white md:text-7xl">Seu som.<br />Seu período.</h2>
        <p className="mt-5 max-w-2xl text-base font-medium text-white/75 md:text-lg">Um recorte visual de {period}, com os artistas, álbuns e faixas que mais tocaram.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <span className="rounded-full bg-black/20 px-4 py-2 text-sm font-bold text-white"><Play className="mr-2 inline h-4 w-4 fill-current" />{compactBR.format(data.kpis.plays)} plays</span>
          <span className="rounded-full bg-black/20 px-4 py-2 text-sm font-bold text-white"><UserRound className="mr-2 inline h-4 w-4" />{compactBR.format(data.kpis.artists)} artistas</span>
          {hasDuration && <span className="rounded-full bg-black/20 px-4 py-2 text-sm font-bold text-white"><Headphones className="mr-2 inline h-4 w-4" />{formatDuration(data.kpis.totalMs)}</span>}
        </div>
      </div>
    </div>

    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-petal">Top performers</p><h3 className="mt-1 text-3xl font-black tracking-tight">Artistas principais</h3></div>
        <UserRound className="h-8 w-8 text-white/10" />
      </div>
      {artists.length > 0 ? <div className="grid auto-rows-[210px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {artists.map((item, index) => <div key={`${item.name}-${index}`} className={`${index === 0 ? 'sm:row-span-2 lg:col-span-2' : index === 1 ? 'lg:col-span-2' : ''}`}><ArtworkCard item={item} rank={index + 1} large={index === 0} /></div>)}
      </div> : <div className="panel text-sm text-zinc-500">Nenhum artista disponível neste recorte.</div>}
    </div>

    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-slime">On repeat</p><h3 className="mt-1 text-3xl font-black tracking-tight">Álbuns principais</h3></div>
        <Disc3 className="h-8 w-8 text-white/10" />
      </div>
      {albums.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((item, index) => <ArtworkCard key={`${item.name}-${item.artist ?? ''}`} item={item} rank={index + 1} />)}
      </div> : <div className="panel text-sm text-zinc-500">As capas aparecem quando o histórico contém image_url e álbum.</div>}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <article className="panel overflow-hidden p-0 md:p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-6"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-banana">Faixas em destaque</p><h3 className="mt-1 text-2xl font-black">Mais ouvidas</h3></div><Music2 className="h-7 w-7 text-banana" /></div>
        <ol className="divide-y divide-white/5">
          {tracks.map((track, index) => <li key={`${track.name}-${track.artist ?? ''}`} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.04] md:px-6">
            <span className="w-6 text-sm font-black text-zinc-600 group-hover:text-slime">{String(index + 1).padStart(2, '0')}</span>
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white/5">{track.imageUrl ? <img src={track.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" /> : <span className="flex h-full items-center justify-center"><Music2 className="h-4 w-4 text-zinc-600" /></span>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{track.name}</p><p className="truncate text-xs text-zinc-500">{track.artist}</p></div>
            <span className="shrink-0 text-xs font-bold text-zinc-400">{compactBR.format(track.plays)} plays</span>
          </li>)}
        </ol>
      </article>

      <aside className="panel flex flex-col justify-between overflow-hidden bg-gradient-to-br from-graphite via-graphite to-petal/10">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-zinc-500">Resumo do recorte</p><h3 className="mt-2 text-3xl font-black leading-tight">A trilha que definiu {period}.</h3></div>
        <div className="my-8 space-y-3">
          <div className="rounded-2xl bg-carbon/60 p-4"><Play className="mb-3 h-5 w-5 text-slime" /><p className="text-3xl font-black text-white">{compactBR.format(data.kpis.plays)}</p><p className="text-xs text-zinc-500">reproduções registradas</p></div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-carbon/60 p-4"><UserRound className="mb-3 h-5 w-5 text-petal" /><p className="text-2xl font-black text-white">{compactBR.format(data.kpis.artists)}</p><p className="text-xs text-zinc-500">artistas</p></div><div className="rounded-2xl bg-carbon/60 p-4"><Music2 className="mb-3 h-5 w-5 text-banana" /><p className="text-2xl font-black text-white">{compactBR.format(data.kpis.tracks)}</p><p className="text-xs text-zinc-500">faixas</p></div></div>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">As imagens usam as URLs disponíveis no arquivo carregado. Quando não há imagem, o mosaico cria uma capa visual de fallback.</p>
      </aside>
    </div>
  </section>;
}
