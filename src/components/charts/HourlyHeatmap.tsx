import type { HeatCell } from '../../types';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function HourlyHeatmap({ data, hasDuration }: { data: HeatCell[]; hasDuration: boolean }) {
  if (!data.length) return <ChartEmpty />;
  const lookup = new Map(data.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.value]));
  const max = Math.max(...data.map((cell) => cell.value), 1);
  return <div className="overflow-x-auto pb-2"><div className="min-w-[720px]">
    <div className="mb-2 grid grid-cols-[42px_repeat(24,minmax(22px,1fr))] gap-1"><span />{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center text-[9px] text-zinc-500">{hour % 3 === 0 ? hour : ''}</span>)}</div>
    <div className="space-y-1">{days.map((day, dayIndex) => <div key={day} className="grid grid-cols-[42px_repeat(24,minmax(22px,1fr))] gap-1"><span className="pr-2 text-right text-[10px] leading-[22px] text-zinc-500">{day}</span>{Array.from({ length: 24 }, (_, hour) => { const value = lookup.get(`${dayIndex + 1}-${hour}`) ?? 0; const intensity = value / max; return <div key={hour} className="h-[22px] rounded-[5px] border border-white/[0.03] transition hover:scale-110" style={{ backgroundColor: value ? `rgba(163,230,53,${0.1 + intensity * 0.9})` : 'rgba(255,255,255,.035)' }} title={`${day}, ${hour}h — ${hasDuration ? `${(value / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : `${compactBR.format(value)} plays`}`} />; })}</div>)}</div>
    <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-zinc-500">menos {Array.from({ length: 5 }, (_, i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `rgba(163,230,53,${.08 + i * .23})` }} />)} mais</div>
  </div></div>;
}
