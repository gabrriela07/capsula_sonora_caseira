import { useState } from 'react';
import { ArrowRight, Clock3, GitBranch, Repeat2 } from 'lucide-react';
import type { ListeningTransition, RankedItem } from '../../types';
import { ArtworkImage } from '../media/ArtworkImage';

function artistItem(name: string, artists: RankedItem[]): RankedItem {
  return artists.find((artist) => artist.name === name) ?? { name, value: 0, plays: 0 };
}

export function ListeningFlow({ transitions, artists }: { transitions: ListeningTransition[]; artists: RankedItem[] }) {
  const [active, setActive] = useState(0);
  if (!transitions.length) return <div className="panel py-12 text-center text-sm text-zinc-500">Ainda não há trocas de artista suficientes neste recorte.</div>;
  const selected = transitions[Math.min(active, transitions.length - 1)];
  const max = Math.max(...transitions.map((transition) => transition.count), 1);

  return <div className="panel overflow-hidden p-0 md:p-0">
    <div className="grid lg:grid-cols-[1fr_330px]">
      <div className="min-w-0 overflow-x-auto p-5 md:p-6">
        <div className="flex min-w-max items-center gap-2 pb-2">
          {transitions.map((transition, index) => {
            const from = artistItem(transition.from, artists);
            const to = artistItem(transition.to, artists);
            const isActive = active === index;
            return <button key={`${transition.from}-${transition.to}`} type="button" onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} className={`group relative flex w-[250px] items-center gap-2 rounded-2xl border p-3 text-left transition ${isActive ? 'border-slime/45 bg-slime/10 shadow-[0_12px_30px_rgba(163,230,53,.08)]' : 'border-white/10 bg-carbon/45 hover:border-white/20 hover:bg-carbon/70'}`}>
              <ArtworkImage item={from} kind="artist" alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-carbon" />
              <ArrowRight className={`h-4 w-4 shrink-0 transition ${isActive ? 'text-slime' : 'text-zinc-600 group-hover:text-zinc-300'}`} />
              <ArtworkImage item={to} kind="artist" alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-carbon" />
              <span className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{transition.from}</b><span className="block truncate text-[10px] text-zinc-500">depois {transition.to}</span></span>
              <span className="absolute bottom-0 left-3 right-3 h-0.5 overflow-hidden rounded-full bg-white/5"><i className="block h-full rounded-full bg-slime" style={{ width: `${transition.count / max * 100}%` }} /></span>
            </button>;
          })}
        </div>
      </div>
      <aside className="border-t border-white/10 bg-gradient-to-br from-white/[.035] to-petal/[.06] p-5 lg:border-l lg:border-t-0 md:p-6">
        <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-petal"><GitBranch className="h-4 w-4" /> sequência em destaque</p>
        <div className="mt-5 flex items-center gap-3">
          <ArtworkImage item={artistItem(selected.from, artists)} kind="artist" alt="" className="h-14 w-14 rounded-2xl object-cover" />
          <ArrowRight className="h-5 w-5 text-slime" />
          <ArtworkImage item={artistItem(selected.to, artists)} kind="artist" alt="" className="h-14 w-14 rounded-2xl object-cover" />
        </div>
        <p className="mt-4 text-xl font-black leading-tight text-white">{selected.from} <span className="text-zinc-600">→</span> {selected.to}</p>
        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-carbon/55 p-3"><Repeat2 className="h-4 w-4 text-slime" /><b className="mt-2 block text-lg text-white">{selected.count}</b><span className="text-[10px] text-zinc-500">transições</span></div><div className="rounded-xl bg-carbon/55 p-3"><Clock3 className="h-4 w-4 text-banana" /><b className="mt-2 block text-lg text-white">{Math.round(selected.avgGapMinutes)} min</b><span className="text-[10px] text-zinc-500">intervalo médio</span></div></div>
      </aside>
    </div>
  </div>;
}
