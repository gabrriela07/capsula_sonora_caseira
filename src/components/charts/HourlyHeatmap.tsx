import { useState } from 'react';
import type { HeatCell, HeatmapMode } from '../../types';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAYS_FULL = ['na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado', 'no domingo'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_FULL = ['em janeiro', 'em fevereiro', 'em março', 'em abril', 'em maio', 'em junho', 'em julho', 'em agosto', 'em setembro', 'em outubro', 'em novembro', 'em dezembro'];

/** Linhas exibidas em cada modo: índice usado na consulta + rótulos. */
function rowsFor(mode: HeatmapMode): Array<{ index: number; label: string; full: string }> {
  if (mode === 'day') return [{ index: 1, label: 'Dia', full: 'no dia' }];
  if (mode === 'month') return MONTHS.map((label, i) => ({ index: i + 1, label, full: MONTHS_FULL[i] }));
  if (mode === 'weekend') return [6, 7].map((index) => ({ index, label: DAYS[index - 1], full: DAYS_FULL[index - 1] }));
  return DAYS.map((label, i) => ({ index: i + 1, label, full: DAYS_FULL[i] }));
}

interface Hover {
  row: number;
  hour: number;
  x: number;
  y: number;
  below: boolean;
}

export function HourlyHeatmap({ data, hasDuration, mode = 'week' }: { data: HeatCell[]; hasDuration: boolean; mode?: HeatmapMode }) {
  const [hover, setHover] = useState<Hover | null>(null);
  if (!data.length) return <ChartEmpty />;
  const rows = rowsFor(mode);
  const lookup = new Map(data.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.value]));
  const max = Math.max(...data.map((cell) => cell.value), 1);
  const total = data.reduce((sum, cell) => sum + cell.value, 0) || 1;
  const formatValue = (value: number) => hasDuration
    ? `${(value / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
    : `${compactBR.format(value)} plays`;
  const ranking = [...data].filter((cell) => cell.value > 0).sort((a, b) => b.value - a.value);

  function insights(rowIndex: number, hour: number) {
    const value = lookup.get(`${rowIndex}-${hour}`) ?? 0;
    const row = rows.find((item) => item.index === rowIndex)!;
    const rowCells = Array.from({ length: 24 }, (_, h) => ({ hour: h, value: lookup.get(`${rowIndex}-${h}`) ?? 0 }));
    const rowAvg = rowCells.reduce((sum, cell) => sum + cell.value, 0) / 24;
    const rowPeak = rowCells.reduce((best, cell) => (cell.value > best.value ? cell : best), rowCells[0]);
    const position = ranking.findIndex((cell) => cell.weekday === rowIndex && cell.hour === hour) + 1;
    const lines: Array<{ tone: 'lime' | 'pink' | 'yellow' | 'muted'; text: string }> = [];
    if (!value) {
      lines.push({ tone: 'muted', text: 'Nenhuma escuta neste horário.' });
      if (rowPeak.value) lines.push({ tone: 'yellow', text: `O pico ${row.full} é às ${rowPeak.hour}h.` });
      return { value, lines, row };
    }
    if (position === 1) lines.push({ tone: 'lime', text: 'Seu horário campeão de escuta.' });
    else if (position <= 5) lines.push({ tone: 'lime', text: `Top ${position} entre ${ranking.length} horários com escuta.` });
    if (rowPeak.hour === hour) lines.push({ tone: 'yellow', text: `Horário de pico ${row.full}.` });
    else lines.push({ tone: 'yellow', text: `Pico ${row.full}: ${rowPeak.hour}h (${formatValue(rowPeak.value)}).` });
    const diff = rowAvg ? Math.round(((value - rowAvg) / rowAvg) * 100) : 0;
    if (diff >= 0) lines.push({ tone: 'pink', text: `${diff}% acima da média por hora ${row.full}.` });
    else lines.push({ tone: 'muted', text: `${Math.abs(diff)}% abaixo da média por hora ${row.full}.` });
    return { value, lines, row };
  }

  const detail = hover ? insights(hover.row, hover.hour) : null;
  const toneClass = { lime: 'bg-slime', pink: 'bg-petal', yellow: 'bg-banana', muted: 'bg-zinc-500' };
  const columns = 'grid-cols-[42px_repeat(24,minmax(22px,1fr))]';

  return <div className="overflow-x-auto pb-2" onMouseLeave={() => setHover(null)} onScroll={() => setHover(null)}>
    <div className="min-w-[720px]">
      <div className={`mb-2 grid ${columns} gap-1`}><span />{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center text-[10px] font-semibold text-zinc-200">{hour % 2 === 0 ? `${hour}h` : ''}</span>)}</div>
      <div className="space-y-1">{rows.map((row) => <div key={row.index} className={`grid ${columns} gap-1`}>
        <span className="pr-2 text-right text-[11px] font-semibold leading-[22px] text-zinc-200">{row.label}</span>
        {Array.from({ length: 24 }, (_, hour) => {
          const value = lookup.get(`${row.index}-${hour}`) ?? 0;
          const intensity = value / max;
          const active = hover?.row === row.index && hover.hour === hour;
          return <div
            key={hour}
            className={`h-[22px] cursor-crosshair rounded-[5px] border transition duration-150 ${active ? 'z-10 scale-125 border-white/70 shadow-[0_0_14px_rgba(163,230,53,.55)]' : 'border-white/[0.03] hover:scale-110'}`}
            style={{ backgroundColor: value ? `rgba(163,230,53,${0.1 + intensity * 0.9})` : 'rgba(255,255,255,.035)' }}
            onMouseEnter={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const below = rect.top < 230;
              setHover({ row: row.index, hour, x: rect.left + rect.width / 2, y: below ? rect.bottom + 10 : rect.top - 10, below });
            }}
          />;
        })}
      </div>)}</div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-zinc-300">menos {Array.from({ length: 5 }, (_, i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `rgba(163,230,53,${.08 + i * .23})` }} />)} mais</div>
    </div>
    {hover && detail && <div
      className={`pointer-events-none fixed z-[80] w-72 max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#232323]/95 p-3.5 text-left shadow-[0_18px_40px_rgba(0,0,0,.5)] backdrop-blur-md ${hover.below ? '' : '-translate-y-full'}`}
      style={{ left: Math.min(Math.max(hover.x, 156), window.innerWidth - 156), top: hover.y }}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{detail.row.label} · {hover.hour}h–{(hover.hour + 1) % 24}h</span>
        <span className="text-[11px] text-zinc-500">{((detail.value / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do total</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slime">{formatValue(detail.value)}</p>
      <ul className="mt-2 space-y-1.5">{detail.lines.map((line) => <li key={line.text} className="flex items-start gap-2 text-xs leading-snug text-zinc-200"><i className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneClass[line.tone]}`} />{line.text}</li>)}</ul>
    </div>}
  </div>;
}
