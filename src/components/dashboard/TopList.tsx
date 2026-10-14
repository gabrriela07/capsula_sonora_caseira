import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Headphones, Play, TrendingUp } from 'lucide-react';
import type { RankedItem, TopKind } from '../../types';
import { compactBR, formatDuration } from '../../lib/format';
import { ArtworkImage } from '../media/ArtworkImage';

interface HoverState {
  item: RankedItem;
  index: number;
  left: number;
  top: number;
  below: boolean;
}

export function TopList({ items, hasDuration, kind }: { items: RankedItem[]; hasDuration: boolean; kind: TopKind }) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  function show(item: RankedItem, index: number, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 12), window.innerWidth - width / 2 - 12);
    const below = rect.top < 235;
    setHover({ item, index, left, top: below ? rect.bottom + 10 : rect.top - 10, below });
  }

  const imageKind = kind === 'artists' ? 'artist' as const : kind === 'albums' ? 'album' as const : 'track' as const;
  const tooltip = hover && typeof document !== 'undefined' ? createPortal(<div
    role="tooltip"
    className={`tooltip-surface pointer-events-none fixed z-[9999] w-80 max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-hidden p-0 ${hover.below ? '' : '-translate-y-full'}`}
    style={{ left: hover.left, top: hover.top }}
  >
    <div className="relative h-32 overflow-hidden bg-gradient-to-br from-petal/40 via-graphite to-slime/30">
      <ArtworkImage item={hover.item} kind={imageKind} alt="" className="h-full w-full object-cover opacity-75" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#222224] via-[#222224]/20 to-transparent" />
      <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-slime backdrop-blur">posição #{hover.index + 1}</span>
      {hover.item.lastFmUrl && <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-white/70" />}
    </div>
    <div className="p-4 pt-2">
      <p className="truncate text-lg font-extrabold text-white">{hover.item.name}</p>
      {hover.item.artist && <p className="truncate text-xs font-semibold text-petal">{hover.item.artist}</p>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/5 p-2.5"><Play className="mb-1 h-3.5 w-3.5 text-slime" /><b className="block text-sm text-white">{compactBR.format(hover.item.plays)}</b><span className="text-[10px] text-zinc-500">reproduções</span></div>
        <div className="rounded-xl bg-white/5 p-2.5"><Headphones className="mb-1 h-3.5 w-3.5 text-petal" /><b className="block text-sm text-white">{hasDuration ? formatDuration(hover.item.value) : compactBR.format(hover.item.value)}</b><span className="text-[10px] text-zinc-500">{hasDuration ? 'tempo' : 'volume'}</span></div>
        <div className="rounded-xl bg-white/5 p-2.5"><TrendingUp className="mb-1 h-3.5 w-3.5 text-banana" /><b className="block text-sm text-white">{(hover.item.value / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b><span className="text-[10px] text-zinc-500">do top exibido</span></div>
      </div>
    </div>
  </div>, document.body) : null;

  return <>
    <ol className="space-y-2">
      {items.map((item, index) => <li
        key={`${item.name}-${item.artist ?? ''}`}
        className="group relative rounded-2xl border border-transparent px-2 py-2.5 transition duration-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.045] focus:border-white/10 focus:bg-white/[0.045] focus:outline-none"
        tabIndex={0}
        onMouseEnter={(event) => show(item, index, event.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onFocus={(event) => show(item, index, event.currentTarget)}
        onBlur={() => setHover(null)}
      >
        <div className="mb-2 flex items-center gap-3">
          <span className="w-6 shrink-0 text-sm font-extrabold text-slime">{String(index + 1).padStart(2, '0')}</span>
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-petal/40 via-graphite to-slime/30">
            <ArtworkImage item={item} kind={imageKind} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white" title={item.name}>{item.name}</p>
            {item.artist && <p className="truncate text-xs text-zinc-500">{item.artist}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs tabular-nums text-zinc-300">
            {hasDuration ? formatDuration(item.value) : `${compactBR.format(item.plays)} plays`}
          </span>
        </div>
        <div className="ml-9 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-slime via-lime-300 to-banana transition-all duration-700 group-hover:brightness-110" style={{ width: `${Math.max(2, item.value / max * 100)}%` }} />
        </div>
      </li>)}
    </ol>

    {tooltip}
  </>;
}
