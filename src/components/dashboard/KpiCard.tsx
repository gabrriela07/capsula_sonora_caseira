import { useId, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react';
import { compactBR, percentChange } from '../../lib/format';

interface Props {
  label: string;
  value: string;
  detail?: string;
  current: number;
  previous: number;
  icon: LucideIcon;
  accent?: 'lime' | 'pink' | 'yellow';
}

interface TooltipPosition {
  left: number;
  top: number;
  below: boolean;
}

export function KpiCard({ label, value, detail, current, previous, icon: Icon, accent = 'lime' }: Props) {
  const tooltipId = useId();
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const change = percentChange(current, previous);
  const positive = change !== null && change > 0;
  const negative = change !== null && change < 0;
  const ChangeIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const color = accent === 'pink' ? 'text-petal' : accent === 'yellow' ? 'text-banana' : 'text-slime';
  const glow = accent === 'pink' ? 'group-hover:shadow-[0_18px_45px_rgba(209,98,164,.12)]' : accent === 'yellow' ? 'group-hover:shadow-[0_18px_45px_rgba(250,238,102,.1)]' : 'group-hover:shadow-[0_18px_45px_rgba(163,230,53,.12)]';
  const max = Math.max(current, previous, 1);

  function show(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const width = Math.min(292, window.innerWidth - 24);
    const left = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 12), window.innerWidth - width / 2 - 12);
    const below = rect.top < 210;
    setPosition({ left, top: below ? rect.bottom + 10 : rect.top - 10, below });
  }

  return <article
    className={`panel group relative min-w-0 animate-fade-up overflow-visible transition duration-300 hover:-translate-y-1 hover:border-white/20 ${glow}`}
    tabIndex={0}
    aria-describedby={tooltipId}
    onMouseEnter={(event) => show(event.currentTarget)}
    onMouseLeave={() => setPosition(null)}
    onFocus={(event) => show(event.currentTarget)}
    onBlur={() => setPosition(null)}
  >
    <div className="pointer-events-none absolute inset-x-6 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-white/35 to-transparent transition duration-500 group-hover:scale-x-100" />
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-zinc-400">{label}</span>
      <span className="rounded-xl border border-white/5 bg-white/5 p-2 transition duration-300 group-hover:scale-110 group-hover:border-white/10">
        <Icon className={`h-5 w-5 ${color}`} />
      </span>
    </div>
    <p className={`mt-4 truncate text-3xl font-extrabold tracking-tight ${color}`} title={value}>{value}</p>
    <div className="mt-2 flex min-h-5 items-center gap-2 text-xs">
      <span className="truncate text-zinc-400">{detail}</span>
      <span className={`ml-auto inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-semibold ${positive ? 'bg-slime/10 text-slime' : negative ? 'bg-petal/10 text-petal' : 'bg-white/5 text-zinc-500'}`}>
        <ChangeIcon className="h-3.5 w-3.5" />
        {change === null ? 'novo' : `${Math.abs(change).toFixed(0)}%`}
      </span>
    </div>

    {position && <div
      id={tooltipId}
      role="tooltip"
      className={`tooltip-surface pointer-events-none fixed z-[80] w-[292px] max-w-[calc(100vw-24px)] -translate-x-1/2 ${position.below ? '' : '-translate-y-full'}`}
      style={{ left: position.left, top: position.top }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <span className="rounded-lg bg-white/5 p-2"><Icon className={`h-4 w-4 ${color}`} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-[.13em] text-zinc-400">{label}</p>
          <p className={`mt-0.5 text-xl font-extrabold ${color}`}>{value}</p>
        </div>
        <Sparkles className="h-4 w-4 text-white/20" />
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-zinc-400"><span>Período atual</span><b className="text-white">{compactBR.format(current)}</b></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-slime" style={{ width: `${Math.max(3, current / max * 100)}%` }} /></div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-zinc-400"><span>Período anterior</span><b className="text-white">{compactBR.format(previous)}</b></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-zinc-500" style={{ width: `${Math.max(3, previous / max * 100)}%` }} /></div>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Variação calculada contra o intervalo imediatamente anterior, com a mesma duração.</p>
    </div>}
  </article>;
}
