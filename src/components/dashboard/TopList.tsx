import type { RankedItem } from '../../types';
import { compactBR, formatDuration } from '../../lib/format';

export function TopList({ items, hasDuration }: { items: RankedItem[]; hasDuration: boolean }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <ol className="space-y-4">
    {items.map((item, index) => <li key={`${item.name}-${item.artist ?? ''}`} className="group">
      <div className="mb-1.5 flex items-end gap-3">
        <span className="w-5 shrink-0 text-sm font-extrabold text-slime">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white" title={item.name}>{item.name}</p>{item.artist && <p className="truncate text-xs text-zinc-500">{item.artist}</p>}</div>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400">{hasDuration ? formatDuration(item.value) : `${compactBR.format(item.plays)} plays`}</span>
      </div>
      <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-slime to-lime-300 transition-all duration-700 group-hover:brightness-110" style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></div>
    </li>)}
  </ol>;
}
