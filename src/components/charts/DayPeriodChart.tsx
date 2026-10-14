import { useId, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DayPeriod } from '../../types';
import { CHART_COLORS } from '../../lib/chartTheme';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

const ORDER = ['Madrugada', 'Manhã', 'Tarde', 'Noite'];

export function DayPeriodChart({ data, hasDuration }: { data: DayPeriod[]; hasDuration: boolean }) {
  const gradientId = useId().replace(/:/g, '');
  const [active, setActive] = useState(0);
  if (!data.length) return <ChartEmpty />;
  const sorted = [...data].sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const total = sorted.reduce((sum, item) => sum + item.value, 0) || 1;
  const normalized = sorted.map((item) => ({ ...item, display: hasDuration ? item.value / 3_600_000 : item.value, share: item.value / total }));
  const selected = normalized[Math.min(active, normalized.length - 1)];
  const formatValue = (value: number) => hasDuration
    ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
    : `${compactBR.format(value)} plays`;

  return <div>
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%"><PieChart>
        <defs>{CHART_COLORS.map((color, index) => <linearGradient key={color} id={`${gradientId}-${index}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color} stopOpacity={1} /><stop offset="100%" stopColor={color} stopOpacity={0.68} /></linearGradient>)}</defs>
        <Pie
          data={normalized}
          dataKey="display"
          nameKey="name"
          innerRadius="59%"
          outerRadius="84%"
          paddingAngle={5}
          cornerRadius={12}
          stroke="rgba(23,23,23,.7)"
          strokeWidth={3}
          startAngle={90}
          endAngle={-270}
          isAnimationActive
          animationDuration={950}
          animationEasing="ease-out"
          onMouseEnter={(_, index) => setActive(index)}
        >
          {normalized.map((item, index) => <Cell key={item.name} fill={`url(#${gradientId}-${index % CHART_COLORS.length})`} opacity={active === index ? 1 : 0.72} style={{ filter: active === index ? `drop-shadow(0 7px 10px ${CHART_COLORS[index % CHART_COLORS.length]}35)` : 'none', transition: 'opacity .25s ease, filter .25s ease' }} />)}
        </Pie>
        <Tooltip cursor={false} content={({ active: tooltipActive, payload }) => {
          const item = tooltipActive && payload?.length ? payload[0].payload as (typeof normalized)[number] : null;
          if (!item) return null;
          return <div className="tooltip-surface px-3.5 py-2.5"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{item.name}</p><p className="mt-1 text-lg font-extrabold text-white">{formatValue(item.display)}</p><p className="text-xs text-slime">{(item.share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da sua escuta</p></div>;
        }} />
      </PieChart></ResponsiveContainer>
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/[.06] bg-carbon/35 text-center shadow-inner backdrop-blur-sm">
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-zinc-500">{selected.name}</span>
        <b className="mt-1 text-2xl font-black text-white">{Math.round(selected.share * 100)}%</b>
        <span className="mt-0.5 text-[10px] text-zinc-500">{formatValue(selected.display)}</span>
      </div>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{normalized.map((item, index) => <button type="button" key={item.name} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} className={`flex items-center justify-between rounded-xl border px-2.5 py-2 text-left text-xs transition ${active === index ? 'border-white/15 bg-white/[.06] text-white' : 'border-transparent bg-white/[.025] text-zinc-400 hover:bg-white/[.05]'}`}><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.name}</span><b>{Math.round(item.share * 100)}%</b></button>)}</div>
  </div>;
}
