import { Radar, RadarChart, PolarAngleAxis, PolarGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock3, Sparkles, Star, UsersRound } from 'lucide-react';
import type { DashboardData } from '../../types';
import { compactBR } from '../../lib/format';

export function DiscoverySignatureChart({ data }: { data: DashboardData }) {
  const newArtists = data.discovery.reduce((sum, point) => sum + point.count, 0);
  const peak = [...data.heatmap].sort((a, b) => b.value - a.value)[0];
  const top = data.topArtists[0];
  const totalTop = data.topArtists.reduce((sum, artist) => sum + artist.value, 0) || 1;
  const loyaltyMax = Math.max(...data.loyal.map((artist) => artist.years), 1);
  const loyaltyAverage = data.loyal.length ? data.loyal.reduce((sum, artist) => sum + artist.years, 0) / data.loyal.length : 0;
  const novelty = Math.min(100, newArtists / Math.max(data.kpis.artists, 1) * 100);
  const diversity = Math.max(0, 100 - ((top?.value ?? 0) / totalTop * 100));
  const loyalty = Math.min(100, loyaltyAverage / loyaltyMax * 100);
  const rhythm = peak ? Math.min(100, peak.value / Math.max(data.heatmap.reduce((sum, cell) => sum + cell.value, 0) / Math.max(data.heatmap.length, 1), 1) * 22) : 0;
  const chart = [
    { metric: 'Novidade', value: novelty },
    { metric: 'Diversidade', value: diversity },
    { metric: 'Fidelidade', value: loyalty },
    { metric: 'Ritmo', value: rhythm },
  ];

  return <div className="grid min-h-[288px] gap-3 lg:grid-cols-[1fr_150px]">
    <div className="h-64 min-w-0"><ResponsiveContainer width="100%" height="100%"><RadarChart data={chart} outerRadius="70%">
      <PolarGrid stroke="rgba(255,255,255,.1)" />
      <PolarAngleAxis dataKey="metric" tick={{ fill: '#d4d4d8', fontSize: 11, fontWeight: 700 }} />
      <Radar dataKey="value" stroke="#D162A4" fill="#D162A4" fillOpacity={0.3} strokeWidth={2.5} dot={{ r: 3, fill: '#FAEE66', strokeWidth: 0 }} isAnimationActive animationDuration={900} />
      <Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? <div className="tooltip-surface px-3 py-2"><b className="text-sm text-white">{payload[0].payload.metric}</b><p className="text-xs text-petal">índice {Math.round(Number(payload[0].value))}/100</p></div> : null} />
    </RadarChart></ResponsiveContainer></div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
      <div className="rounded-2xl bg-carbon/55 p-3"><Sparkles className="h-4 w-4 text-banana" /><b className="mt-2 block text-lg text-white">{compactBR.format(newArtists)}</b><span className="text-[10px] text-zinc-500">novos artistas</span></div>
      <div className="rounded-2xl bg-carbon/55 p-3"><Clock3 className="h-4 w-4 text-slime" /><b className="mt-2 block text-lg text-white">{peak ? `${peak.hour}h` : '—'}</b><span className="text-[10px] text-zinc-500">hora de pico</span></div>
      <div className="rounded-2xl bg-carbon/55 p-3"><Star className="h-4 w-4 text-petal" /><b className="mt-2 block truncate text-sm text-white" title={top?.name}>{top?.name ?? '—'}</b><span className="text-[10px] text-zinc-500">artista central</span></div>
      <div className="rounded-2xl bg-carbon/55 p-3"><UsersRound className="h-4 w-4 text-zinc-300" /><b className="mt-2 block text-lg text-white">{loyaltyAverage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b><span className="text-[10px] text-zinc-500">anos de vínculo</span></div>
    </div>
  </div>;
}
