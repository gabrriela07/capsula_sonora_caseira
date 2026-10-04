import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DiscoveryPoint } from '../../types';
import { tooltipStyle } from '../../lib/chartTheme';
import { ChartEmpty } from './ChartEmpty';

export function DiscoveryChart({ data }: { data: DiscoveryPoint[] }) {
  if (!data.length) return <ChartEmpty label="Nenhum artista estreou neste recorte" />;
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={30} tickFormatter={(value: string) => value.slice(0, 7)} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value), 'Novos artistas']} /><Bar dataKey="count" fill="#FAEE66" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
