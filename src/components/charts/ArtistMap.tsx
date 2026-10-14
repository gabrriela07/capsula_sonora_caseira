import { useMemo, useState } from 'react';
import { Headphones, Orbit, Play, Sparkles } from 'lucide-react';
import type { RankedItem } from '../../types';
import { compactBR, formatDuration } from '../../lib/format';
import { ArtworkImage } from '../media/ArtworkImage';

type Node = { item: RankedItem; x: number; y: number; size: number; orbit: number };

/**
 * Substitui o mapa geográfico — que dependia de país/MBID — por uma constelação
 * criada com todos os artistas líderes do próprio recorte. Assim nenhum artista
 * desaparece quando uma API externa não conhece sua origem.
 */
export function ArtistMap({ artists, hasDuration = true }: { artists: RankedItem[]; hasDuration?: boolean }) {
  const visible = artists.slice(0, 16);
  const [activeIndex, setActiveIndex] = useState(0);
  const nodes = useMemo<Node[]>(() => {
    const max = Math.max(...visible.map((artist) => artist.value), 1);
    return visible.map((item, index) => {
      if (index === 0) return { item, x: 50, y: 50, size: 82, orbit: 0 };
      const orbit = index <= 5 ? 1 : index <= 10 ? 2 : 3;
      const indexInOrbit = orbit === 1 ? index - 1 : orbit === 2 ? index - 6 : index - 11;
      const countInOrbit = orbit === 1 ? 5 : orbit === 2 ? 5 : Math.max(visible.length - 11, 1);
      const offset = orbit === 2 ? 0.42 : orbit === 3 ? 0.18 : 0;
      const angle = ((indexInOrbit / countInOrbit) * Math.PI * 2) - Math.PI / 2 + offset;
      const radiusX = orbit === 1 ? 20 : orbit === 2 ? 34 : 45;
      const radiusY = orbit === 1 ? 22 : orbit === 2 ? 34 : 42;
      return {
        item,
        x: 50 + Math.cos(angle) * radiusX,
        y: 50 + Math.sin(angle) * radiusY,
        size: 42 + Math.sqrt(item.value / max) * 25,
        orbit,
      };
    });
  }, [visible.map((artist) => `${artist.name}:${artist.value}`).join('|')]);
  const active = nodes[Math.min(activeIndex, Math.max(nodes.length - 1, 0))];
  const total = visible.reduce((sum, artist) => sum + artist.value, 0) || 1;

  if (!visible.length) return <div className="panel py-12 text-center text-sm text-zinc-500">Nenhum artista disponível para montar a constelação.</div>;

  return <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-carbon/60">
    <div className="map-grid relative min-h-[500px] overflow-hidden sm:min-h-[560px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(209,98,164,.13),transparent_32%),radial-gradient(circle_at_70%_20%,rgba(163,230,53,.08),transparent_30%)]" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {[1, 2, 3].map((orbit) => <ellipse key={orbit} cx="50" cy="50" rx={orbit === 1 ? 20 : orbit === 2 ? 34 : 45} ry={orbit === 1 ? 22 : orbit === 2 ? 34 : 42} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth=".25" strokeDasharray={orbit === 2 ? '1 1.5' : undefined} />)}
        {nodes.slice(1).map((node, index) => <line key={`${node.item.name}-${index}`} x1="50" y1="50" x2={node.x} y2={node.y} stroke={activeIndex === index + 1 ? 'rgba(250,238,102,.65)' : 'rgba(163,230,53,.13)'} strokeWidth={activeIndex === index + 1 ? '.5' : '.2'} className="transition-all duration-300" />)}
      </svg>

      <div className="absolute left-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-white"><Orbit className="h-4 w-4 text-slime" /> Galáxia de artistas</div>
        <p className="mt-1 max-w-[235px] text-[10px] leading-relaxed text-zinc-400">Centro = artista líder. Órbitas e tamanhos representam posição e intensidade.</p>
      </div>

      {nodes.map((node, index) => <button
        key={node.item.name}
        type="button"
        className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition duration-300 focus:outline-none ${activeIndex === index ? 'z-30 scale-110' : 'hover:z-20 hover:scale-110'}`}
        style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.size, height: node.size }}
        onMouseEnter={() => setActiveIndex(index)}
        onFocus={() => setActiveIndex(index)}
        onClick={() => setActiveIndex(index)}
        aria-label={`${node.item.name}, posição ${index + 1}`}
      >
        <span className={`absolute -inset-2 rounded-full blur-md transition ${activeIndex === index ? 'bg-slime/25 opacity-100' : 'bg-petal/15 opacity-0 group-hover:opacity-100'}`} />
        <ArtworkImage item={node.item} kind="artist" alt="" className={`relative h-full w-full rounded-full border-2 object-cover shadow-[0_10px_28px_rgba(0,0,0,.5)] ${activeIndex === index ? 'border-banana' : 'border-white/20'}`} />
        <span className="absolute -bottom-5 left-1/2 max-w-[120px] -translate-x-1/2 truncate rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white opacity-0 backdrop-blur transition group-hover:opacity-100 sm:opacity-100">{node.item.name}</span>
      </button>)}

      {active && <div className="absolute bottom-4 left-4 right-4 z-40 rounded-2xl border border-white/10 bg-[#222224]/95 p-4 shadow-2xl backdrop-blur-xl sm:left-auto sm:w-[340px]">
        <div className="flex items-start gap-3"><ArtworkImage item={active.item} kind="artist" alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" /><div className="min-w-0 flex-1"><p className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-slime"><Sparkles className="h-3.5 w-3.5" />órbita {active.orbit || 'central'}</p><p className="mt-1 truncate text-xl font-black text-white">{active.item.name}</p><p className="text-xs text-zinc-500">posição #{activeIndex + 1}</p></div></div>
        <div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/5 p-2.5"><Play className="h-3.5 w-3.5 text-slime" /><b className="mt-1 block text-sm text-white">{compactBR.format(active.item.plays)}</b><span className="text-[9px] text-zinc-500">plays</span></div><div className="rounded-xl bg-white/5 p-2.5"><Headphones className="h-3.5 w-3.5 text-petal" /><b className="mt-1 block text-sm text-white">{hasDuration ? formatDuration(active.item.value) : compactBR.format(active.item.value)}</b><span className="text-[9px] text-zinc-500">intensidade</span></div><div className="rounded-xl bg-white/5 p-2.5"><Orbit className="h-3.5 w-3.5 text-banana" /><b className="mt-1 block text-sm text-white">{(active.item.value / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b><span className="text-[9px] text-zinc-500">do top</span></div></div>
      </div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[10px] text-zinc-500"><span>Visual 100% local: não depende mais de país ou geocodificação</span><span>{visible.length} artistas conectados</span></div>
  </div>;
}
