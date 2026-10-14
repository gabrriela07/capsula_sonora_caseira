import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TimePoint } from '../../types';
import { compactBR } from '../../lib/format';
import { tooltipStyle } from '../../lib/chartTheme';
import { ChartEmpty } from './ChartEmpty';

function labelForPeriod(value: string, averageGap: number) {
  const date = parseISO(value.slice(0, 10));
  if (averageGap > 300) return format(date, 'yyyy');
  if (averageGap > 25) return format(date, "MMM/yy", { locale: ptBR });
  return format(date, 'dd/MM');
}

export function EvolutionChart({ data, hasDuration, cumulative = false }: { data: TimePoint[]; hasDuration: boolean; cumulative?: boolean }) {
  if (!data.length) return <ChartEmpty />;

  const key = cumulative ? 'cumulative' : 'value';
  const normalized = data.map((point) => ({ ...point, display: hasDuration ? Number(point[key] ?? 0) / 3_600_000 : Number(point[key] ?? 0) }));
  const gaps = data.slice(1).map((point, index) => Math.max(1, (parseISO(point.period).getTime() - parseISO(data[index].period).getTime()) / 86_400_000));
  const averageGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 31;
  const rotate = data.length > 7;
  const pointWidth = rotate ? 68 : 92;
  const chartWidth = Math.max(560, data.length * pointWidth);

  return <div className="w-full overflow-x-auto pb-2">
    <div className="h-80" style={{ minWidth: chartWidth }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={normalized} margin={{ top: 12, right: 22, left: -12, bottom: rotate ? 58 : 20 }}>
          <defs>
            <linearGradient id={cumulative ? 'cumulativeGradient' : 'evolutionGradient'} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cumulative ? '#D162A4' : '#A3E635'} stopOpacity={0.38} />
              <stop offset="100%" stopColor={cumulative ? '#D162A4' : '#A3E635'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
          <XAxis
            dataKey="period"
            interval={0}
            height={rotate ? 76 : 38}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#a1a1aa', textAnchor: rotate ? 'end' : 'middle' }}
            angle={rotate ? -45 : 0}
            tickMargin={rotate ? 10 : 8}
            tickFormatter={(value: string) => labelForPeriod(value, averageGap)}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => compactBR.format(value)} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#d4d4d8' }}
            labelFormatter={(value: unknown) => format(parseISO(String(value).slice(0, 10)), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            formatter={(value: unknown) => [`${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${hasDuration ? 'horas' : 'plays'}`, cumulative ? 'Acumulado' : 'Total']}
          />
          <Area
            type="monotone"
            dataKey="display"
            stroke={cumulative ? '#D162A4' : '#A3E635'}
            strokeWidth={3}
            fill={`url(#${cumulative ? 'cumulativeGradient' : 'evolutionGradient'})`}
            dot={{ r: 2.5, fill: cumulative ? '#D162A4' : '#A3E635', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#FAEE66', stroke: '#171717', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    {chartWidth > 900 && <p className="mt-1 text-right text-[10px] text-zinc-600">Todos os rótulos estão visíveis · role horizontalmente para explorar</p>}
  </div>;
}
