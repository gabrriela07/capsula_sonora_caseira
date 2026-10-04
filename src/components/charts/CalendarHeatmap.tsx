import { differenceInCalendarWeeks, eachDayOfInterval, format, getISODay, parseISO, startOfWeek } from 'date-fns';
import type { CalendarCell } from '../../types';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

export function CalendarHeatmap({ data, hasDuration }: { data: CalendarCell[]; hasDuration: boolean }) {
  if (!data.length) return <ChartEmpty />;
  const lookup = new Map(data.map((cell) => [cell.day, cell]));
  const start = parseISO(data[0].day);
  const end = parseISO(data[data.length - 1].day);
  const firstWeek = startOfWeek(start, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const max = Math.max(...data.map((cell) => cell.value), 1);
  const weeks = differenceInCalendarWeeks(end, firstWeek, { weekStartsOn: 1 }) + 1;
  return <div className="overflow-x-auto pb-3"><div className="grid min-w-max auto-cols-[13px] grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, 13px)` }}>
    {days.map((day: Date) => { const key = format(day, 'yyyy-MM-dd'); const cell = lookup.get(key); const value = cell?.value ?? 0; const intensity = value / max; return <div key={key} className="h-[13px] w-[13px] rounded-[3px] border border-white/[0.03] transition hover:scale-125" style={{ gridColumn: differenceInCalendarWeeks(day, firstWeek, { weekStartsOn: 1 }) + 1, gridRow: getISODay(day), backgroundColor: value ? `rgba(209,98,164,${0.12 + intensity * .88})` : 'rgba(255,255,255,.035)' }} title={`${key} — ${hasDuration ? `${(value / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : `${compactBR.format(cell?.plays ?? 0)} plays`}`} />; })}
  </div><div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-zinc-500">menos {Array.from({ length: 5 }, (_, i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `rgba(209,98,164,${.08 + i * .23})` }} />)} mais</div></div>;
}
