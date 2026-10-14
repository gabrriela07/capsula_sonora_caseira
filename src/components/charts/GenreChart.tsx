import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GenreItem } from '../../types';
import { AXIS_TICK, CHART_COLORS } from '../../lib/chartTheme';
import { compactBR } from '../../lib/format';
import { ChartEmpty } from './ChartEmpty';

const titleCase = (text: string) => text.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());

/** Volume por gênero/tag musical (tag principal de cada artista no Last.fm). */
export function GenreChart({ data, hasDuration }: { data: GenreItem[]; hasDuration: boolean }) {
  if (!data.length) return <ChartEmpty label="Nenhum gênero disponível neste recorte" />;
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const normalized = data.map((item) => ({ ...item, label: titleCase(item.name), display: hasDuration ? item.value / 3_600_000 : item.value, share: item.value / total }));
  const formatValue = (value: number) => hasDuration
    ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
    : `${compactBR.format(value)} plays`;
  return <div className="w-full" style={{ height: Math.max(240, normalized.length * 34 + 20) }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={normalized} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value: number) => compactBR.format(value)} />
        <YAxis type="category" dataKey="label" width={120} tickLine={false} axisLine={false} tick={{ ...AXIS_TICK, fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,.04)' }}
          content={({ active, payload }) => {
            const item = active && payload?.length ? payload[0].payload as (typeof normalized)[number] : null;
            if (!item) return null;
            return <div className="rounded-xl border border-white/10 bg-[#232323] px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,.45)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{item.label}</p>
              <p className="mt-1 text-lg font-extrabold text-white">{formatValue(item.display)}</p>
              <p className="text-xs text-slime">{(item.share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% · {compactBR.format(item.plays)} plays</p>
            </div>;
          }}
        />
        <Bar dataKey="display" radius={[0, 8, 8, 0]} barSize={20}>
          {normalized.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
          <LabelList dataKey="share" position="right" fill="#e4e4e7" fontSize={11} fontWeight={700} formatter={(value: unknown) => `${Math.round(Number(value) * 100)}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
