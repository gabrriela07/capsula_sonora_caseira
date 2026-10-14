import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BumpGranularity, BumpPoint } from '../../types';
import { AXIS_TICK, CHART_COLORS, tooltipLabelStyle, tooltipStyle } from '../../lib/chartTheme';
import { ChartEmpty } from './ChartEmpty';

/** Rótulo do período conforme a granularidade escolhida no ranking. */
function periodLabel(value: string, granularity: BumpGranularity): string {
  const [year, month, day] = value.split('-');
  if (granularity === 'month') return `${month}/${year}`;
  return `${day}/${month}/${year.slice(2)}`;
}

export function BumpChart({ data, granularity = 'month' }: { data: BumpPoint[]; granularity?: BumpGranularity }) {
  if (!data.length) return <ChartEmpty label="Sem artistas suficientes para calcular o ranking" />;
  const artists = Array.from(new Set(data.map((point) => point.artist)));
  const periods = Array.from(new Set(data.map((point) => point.period))).sort();
  const byKey = new Map(data.map((point) => [`${point.period}\u0000${point.artist}`, point.rank]));
  const rows = periods.map((period) => ({ period, ...Object.fromEntries(artists.map((artist) => [artist, byKey.get(`${period}\u0000${artist}`) ?? null])) }));
  const maxRank = Math.max(...data.map((point) => point.rank), 5);
  return <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
    <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
    <XAxis dataKey="period" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={34} tickFormatter={(value: string) => periodLabel(value, granularity)} />
    <YAxis reversed domain={[1, maxRank]} allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value: number) => `#${value}`} />
    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} labelFormatter={(value: unknown) => `${granularity === 'week' ? 'Semana de ' : ''}${periodLabel(String(value), granularity)}`} formatter={(value: unknown, name: unknown) => [`#${Number(value)}`, String(name)]} />
    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
    {artists.map((artist, index) => <Line key={artist} connectNulls type="monotone" dataKey={artist} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2.5} dot={{ r: granularity === 'day' ? 2 : 3 }} activeDot={{ r: 5 }} />)}
  </LineChart></ResponsiveContainer></div>;
}
