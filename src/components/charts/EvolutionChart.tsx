import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TimePoint } from '../../types';
import { compactBR } from '../../lib/format';
import { tooltipStyle } from '../../lib/chartTheme';
import { ChartEmpty } from './ChartEmpty';

export function EvolutionChart({ data, hasDuration, cumulative = false }: { data: TimePoint[]; hasDuration: boolean; cumulative?: boolean }) {
  if (!data.length) return <ChartEmpty />;
  const key = cumulative ? 'cumulative' : 'value';
  const normalized = data.map((point) => ({ ...point, display: hasDuration ? Number(point[key] ?? 0) / 3_600_000 : Number(point[key] ?? 0) }));
  return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={normalized} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
    <defs><linearGradient id={cumulative ? 'cumulativeGradient' : 'evolutionGradient'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cumulative ? '#D162A4' : '#A3E635'} stopOpacity={0.38} /><stop offset="100%" stopColor={cumulative ? '#D162A4' : '#A3E635'} stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
    <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={34} tickFormatter={(value: string) => value.slice(0, 7)} />
    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => compactBR.format(value)} />
    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#d4d4d8' }} formatter={(value: unknown) => [`${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${hasDuration ? 'horas' : 'plays'}`, cumulative ? 'Acumulado' : 'Total']} />
    <Area type="monotone" dataKey="display" stroke={cumulative ? '#D162A4' : '#A3E635'} strokeWidth={3} fill={`url(#${cumulative ? 'cumulativeGradient' : 'evolutionGradient'})`} activeDot={{ r: 5, fill: '#FAEE66', stroke: '#171717', strokeWidth: 2 }} />
  </AreaChart></ResponsiveContainer></div>;
}
