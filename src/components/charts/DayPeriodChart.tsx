import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DayPeriod } from '../../types';
import { CHART_COLORS, tooltipStyle } from '../../lib/chartTheme';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

export function DayPeriodChart({ data, hasDuration }: { data: DayPeriod[]; hasDuration: boolean }) {
  if (!data.length) return <ChartEmpty />;
  const normalized = data.map((item) => ({ ...item, display: hasDuration ? item.value / 3_600_000 : item.value }));
  return <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={normalized} dataKey="display" nameKey="name" innerRadius="54%" outerRadius="82%" paddingAngle={3} stroke="none">{normalized.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [hasDuration ? `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} horas` : `${compactBR.format(Number(value))} plays`, 'Total']} /></PieChart></ResponsiveContainer><div className="-mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">{normalized.map((item, index) => <span key={item.name} className="flex items-center gap-1.5 text-xs text-zinc-400"><i className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.name}</span>)}</div></div>;
}
