import { forwardRef } from 'react';
import type { RankedItem } from '../../types';
import { numberBR } from '../../lib/format';
import { ProceduralCover } from './ProceduralCover';

interface Props { period: string; totalMs: number; topArtists: RankedItem[]; topTracks: RankedItem[]; cover: string | null; hasDuration: boolean }

function Ranking({ label, items }: { label: string; items: RankedItem[] }) {
  return <div className="min-w-0"><p className="mb-4 text-[15px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{label}</p><ol className="space-y-3">{Array.from({ length: 5 }, (_, index) => <li key={index} className="flex min-w-0 items-baseline gap-3"><span className="w-4 shrink-0 text-[17px] font-extrabold text-slime">{index + 1}</span><span className="truncate text-[17px] font-bold leading-tight text-white">{items[index]?.name ?? '—'}</span></li>)}</ol></div>;
}

export const CapsuleCard = forwardRef<HTMLDivElement, Props>(function CapsuleCard({ period, totalMs, topArtists, topTracks, cover, hasDuration }, ref) {
  const generated = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).replace('.', '');
  return <div ref={ref} className="relative h-[960px] w-[540px] shrink-0 overflow-hidden rounded-[32px] bg-carbon text-white shadow-2xl" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
    <div className="h-[330px] w-full overflow-hidden">{cover ? <img src={cover} alt="Capa personalizada" className="h-full w-full object-cover" /> : <ProceduralCover />}</div>
    <div className="h-[5px] w-full bg-slime" />
    <div className="flex h-[625px] flex-col px-11 pb-9 pt-8">
      <div className="flex items-center justify-between"><span className="rounded-full border border-white/20 bg-graphite px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.13em]">Sound Capsule</span><span className="text-[12px] text-zinc-500">{generated}</span></div>
      <h2 className="mt-7 text-[39px] font-extrabold leading-[1.02] tracking-[-0.045em]">Minha Cápsula Sonora de <span className="text-banana">{period}</span></h2>
      <div className="mt-8 grid grid-cols-2 gap-8"><Ranking label="Top artistas" items={topArtists} /><Ranking label="Top músicas" items={topTracks} /></div>
      <div className="mt-auto border-t border-white/15 pt-6"><p className="text-[14px] font-medium text-zinc-400">Tempo ouvido</p><p className="mt-1 text-[42px] font-extrabold leading-none tracking-[-0.04em] text-slime">{hasDuration ? `${numberBR.format(Math.round(totalMs / 60_000))} minutos` : 'Não disponível'}</p></div>
    </div>
  </div>;
});
