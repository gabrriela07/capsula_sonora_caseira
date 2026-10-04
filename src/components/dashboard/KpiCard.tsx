import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { percentChange } from '../../lib/format';

interface Props { label: string; value: string; detail?: string; current: number; previous: number; icon: LucideIcon; accent?: 'lime' | 'pink' | 'yellow' }

export function KpiCard({ label, value, detail, current, previous, icon: Icon, accent = 'lime' }: Props) {
  const change = percentChange(current, previous);
  const positive = change !== null && change > 0;
  const negative = change !== null && change < 0;
  const ChangeIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const color = accent === 'pink' ? 'text-petal' : accent === 'yellow' ? 'text-banana' : 'text-slime';
  return <article className="panel min-w-0 animate-fade-up transition hover:-translate-y-0.5 hover:border-white/20">
    <div className="flex items-center justify-between"><span className="text-sm font-medium text-zinc-400">{label}</span><Icon className={`h-5 w-5 ${color}`} /></div>
    <p className={`mt-5 truncate text-3xl font-extrabold tracking-tight ${color}`} title={value}>{value}</p>
    <div className="mt-2 flex min-h-5 items-center gap-2 text-xs"><span className="truncate text-zinc-400">{detail}</span><span className={`ml-auto inline-flex shrink-0 items-center font-semibold ${positive ? 'text-slime' : negative ? 'text-petal' : 'text-zinc-500'}`} title="Variação contra o período anterior de mesma duração"><ChangeIcon className="h-3.5 w-3.5" />{change === null ? 'novo' : `${Math.abs(change).toFixed(0)}%`}</span></div>
  </article>;
}
