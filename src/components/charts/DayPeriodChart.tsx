import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DayPeriod } from '../../types';
import { CHART_COLORS } from '../../lib/chartTheme';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

const ORDER = ['Madrugada', 'Manhã', 'Tarde', 'Noite'];
// Tons escurecidos usados na "lateral" do donut para dar profundidade
const SHADOWS = ['#4d6b19', '#6b2f53', '#7d7633', '#3f6110', '#7a5269', '#7f7445'];
const RADIAN = Math.PI / 180;

interface LabelProps {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  percent?: number;
}

/** Rótulo de % centralizado na fatia. */
function renderPercent(props: unknown) {
  const raw = props as LabelProps;
  const [cx, cy, midAngle, innerRadius, outerRadius, percent] = [raw.cx, raw.cy, raw.midAngle, raw.innerRadius, raw.outerRadius, raw.percent].map((value) => Number(value ?? 0));
  if (percent < 0.03) return null;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="#171717" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800}>
    {`${Math.round(percent * 100)}%`}
  </text>;
}

export function DayPeriodChart({ data, hasDuration }: { data: DayPeriod[]; hasDuration: boolean }) {
  if (!data.length) return <ChartEmpty />;
  const sorted = [...data].sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const total = sorted.reduce((sum, item) => sum + item.value, 0) || 1;
  const normalized = sorted.map((item) => ({ ...item, display: hasDuration ? item.value / 3_600_000 : item.value, share: item.value / total }));
  const formatValue = (value: number) => hasDuration
    ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} horas`
    : `${compactBR.format(value)} plays`;
  const pieProps = { data: normalized, dataKey: 'display', nameKey: 'name', innerRadius: '50%', outerRadius: '80%', paddingAngle: 3, stroke: 'none', startAngle: 90, endAngle: -270, isAnimationActive: false } as const;

  return <div>
    <div className="relative h-64">
      {/* Camada inferior deslocada: simula a espessura do donut */}
      <div className="pointer-events-none absolute inset-0 translate-y-[9px]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%"><PieChart>
          <Pie {...pieProps}>{normalized.map((item, index) => <Cell key={item.name} fill={SHADOWS[index % SHADOWS.length]} />)}</Pie>
        </PieChart></ResponsiveContainer>
      </div>
      <div className="absolute inset-0" style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.45))' }}>
        <ResponsiveContainer width="100%" height="100%"><PieChart>
          <defs>{CHART_COLORS.map((color, index) => <radialGradient key={color} id={`dayPeriod3d-${index}`} cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
            <stop offset="45%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.85} />
          </radialGradient>)}</defs>
          <Pie {...pieProps} label={renderPercent} labelLine={false}>
            {normalized.map((item, index) => <Cell key={item.name} fill={`url(#dayPeriod3d-${index % CHART_COLORS.length})`} />)}
          </Pie>
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              const item = active && payload?.length ? payload[0].payload as (typeof normalized)[number] : null;
              if (!item) return null;
              return <div className="rounded-xl border border-white/10 bg-[#232323] px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,.45)]">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{item.name}</p>
                <p className="mt-1 text-lg font-extrabold text-white">{formatValue(item.display)}</p>
                <p className="text-xs text-slime">{(item.share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da sua escuta</p>
              </div>;
            }}
          />
        </PieChart></ResponsiveContainer>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">{normalized.map((item, index) => <span key={item.name} className="flex items-center gap-1.5 text-xs text-zinc-300"><i className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.name} <b className="text-white">{Math.round(item.share * 100)}%</b></span>)}</div>
  </div>;
}
