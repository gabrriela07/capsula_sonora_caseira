import { differenceInCalendarWeeks, eachDayOfInterval, eachMonthOfInterval, format, getISODay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { CalendarCell } from '../../types';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const CELL = 13;
const GAP = 3;

export function CalendarHeatmap({ data, hasDuration }: { data: CalendarCell[]; hasDuration: boolean }) {
  if (!data.length) return <ChartEmpty />;
  const lookup = new Map(data.map((cell) => [cell.day, cell]));
  const start = parseISO(data[0].day);
  const end = parseISO(data[data.length - 1].day);
  const firstWeek = startOfWeek(start, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const max = Math.max(...data.map((cell) => cell.value), 1);
  const weeks = differenceInCalendarWeeks(end, firstWeek, { weekStartsOn: 1 }) + 1;
  const columnOf = (day: Date) => differenceInCalendarWeeks(day, firstWeek, { weekStartsOn: 1 }) + 1;
  // Eixo superior: um rótulo na semana em que cada mês começa; janeiro mostra o ano
  const months = eachMonthOfInterval({ start: startOfMonth(start), end }).map((month) => {
    const anchor = month < start ? start : month;
    return { key: format(month, 'yyyy-MM'), column: columnOf(anchor), label: month.getMonth() === 0 || anchor === start ? `${MONTHS[month.getMonth()]} ${month.getFullYear()}` : MONTHS[month.getMonth()], isYear: month.getMonth() === 0 };
  }).filter((month, index, all) => !all[index + 1] || all[index + 1].column - month.column >= 3); // evita rótulos sobrepostos
  const gridColumns = { gridTemplateColumns: `repeat(${weeks}, ${CELL}px)` };

  return <div className="overflow-x-auto pb-3">
    <div className="flex min-w-max gap-2">
      {/* Eixo lateral: dias da semana */}
      <div className="grid shrink-0 grid-rows-7 pt-[22px] text-right" style={{ gap: GAP }}>
        {WEEKDAYS.map((day, index) => <span key={day} className="pr-1 text-[10px] font-semibold text-zinc-300" style={{ height: CELL, lineHeight: `${CELL}px` }}>{index % 2 === 0 ? day : ''}</span>)}
      </div>
      <div>
        {/* Eixo superior: meses (e ano em janeiro) */}
        <div className="relative mb-[6px] grid h-4" style={{ ...gridColumns, gap: GAP }}>
          {months.map((month) => <span key={month.key} className={`whitespace-nowrap text-[10px] font-semibold ${month.isYear ? 'text-slime' : 'text-zinc-300'}`} style={{ gridColumn: `${month.column} / span 4`, gridRow: 1 }}>{month.label}</span>)}
        </div>
        <div className="grid grid-rows-7" style={{ ...gridColumns, gap: GAP }}>
          {days.map((day: Date) => { const key = format(day, 'yyyy-MM-dd'); const cell = lookup.get(key); const value = cell?.value ?? 0; const intensity = value / max; return <div key={key} className="rounded-[3px] border border-white/[0.03] transition hover:scale-125" style={{ width: CELL, height: CELL, gridColumn: columnOf(day), gridRow: getISODay(day), backgroundColor: value ? `rgba(209,98,164,${0.12 + intensity * .88})` : 'rgba(255,255,255,.035)' }} title={`${WEEKDAYS[getISODay(day) - 1]}, ${format(day, 'dd/MM/yyyy')} — ${hasDuration ? `${(value / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : `${compactBR.format(cell?.plays ?? 0)} plays`}`} />; })}
        </div>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-zinc-400">
      <span>Linhas: dias da semana · Colunas: semanas · Rótulos em verde: início de cada ano</span>
      <span className="flex items-center gap-1">menos {Array.from({ length: 5 }, (_, i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `rgba(209,98,164,${.08 + i * .23})` }} />)} mais</span>
    </div>
  </div>;
}
