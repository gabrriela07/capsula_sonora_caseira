import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Download, Eye, EyeOff, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { toBlob, toPng } from 'html-to-image';
import type { DashboardData, Filters } from '../../types';
import { capsulePeriod, safeFileName } from '../../lib/format';
import { resolveArtwork } from '../../lib/artwork';
import { CapsuleCard } from './CapsuleCard';

type CoverMode = 'auto' | 'manual' | 'procedural';

export function CapsuleModal({ open, onClose, data, filters, hasDuration }: { open: boolean; onClose: () => void; data: DashboardData; filters: Filters; hasDuration: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [autoCover, setAutoCover] = useState<string | null>(null);
  const [autoState, setAutoState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [coverMode, setCoverMode] = useState<CoverMode>('auto');
  const [working, setWorking] = useState<'download' | 'copy' | null>(null);
  const [status, setStatus] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const period = capsulePeriod(filters);
  // Capa automática: imagem associada ao artista mais ouvido do período
  const topArtist = data.topArtists[0];

  useEffect(() => { if (!open) setStatus(''); }, [open]);
  useEffect(() => () => { if (cover?.startsWith('blob:')) URL.revokeObjectURL(cover); }, [cover]);
  useEffect(() => {
    if (!open) return;
    if (!topArtist) { setAutoCover(null); setAutoState('failed'); return; }
    let cancelled = false;
    setAutoState('loading');
    resolveArtwork(topArtist, 'artist')
      .then((dataUrl) => { if (!cancelled) { setAutoCover(dataUrl); setAutoState('ready'); } })
      .catch(() => { if (!cancelled) { setAutoCover(null); setAutoState('failed'); } });
    return () => { cancelled = true; };
  }, [open, topArtist?.name, topArtist?.imageUrl, topArtist?.mbid]);

  if (!open) return null;

  const activeCover = coverMode === 'manual' ? cover : coverMode === 'auto' ? autoCover : null;

  function selectCover(file?: File) {
    if (!file) return;
    if (cover?.startsWith('blob:')) URL.revokeObjectURL(cover);
    setCover(URL.createObjectURL(file));
    setCoverMode('manual');
  }
  async function download() {
    if (!cardRef.current) return;
    setWorking('download'); setStatus('');
    try {
      const dataUrl = await toPng(cardRef.current, { width: 540, height: 960, pixelRatio: 2, backgroundColor: '#171717', cacheBust: true });
      const link = document.createElement('a');
      link.download = `capsula-sonora-${safeFileName(period)}.png`;
      link.href = dataUrl;
      link.click();
      setStatus('PNG gerado em 1080 × 1920 px.');
    } catch { setStatus('Não foi possível gerar o PNG neste navegador.'); }
    finally { setWorking(null); }
  }
  async function copy() {
    if (!cardRef.current) return;
    setWorking('copy'); setStatus('');
    try {
      const blob = await toBlob(cardRef.current, { width: 540, height: 960, pixelRatio: 2, backgroundColor: '#171717', cacheBust: true });
      if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('Imagem copiada para a área de transferência.');
    } catch { setStatus('Seu navegador não permitiu copiar. Use “Baixar PNG”.'); }
    finally { setWorking(null); }
  }
  const option = (mode: CoverMode, label: string, disabled = false) => <button type="button" disabled={disabled} onClick={() => setCoverMode(mode)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${coverMode === mode ? 'bg-slime text-carbon' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}>{label}</button>;

  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm md:p-8" role="dialog" aria-modal="true" aria-label="Pré-visualização da cápsula">
    <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-graphite p-4 shadow-2xl md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Pré-visualização da cápsula</h2><p className="mt-1 text-sm text-zinc-400">A imagem final será exportada em 1080 × 1920 px.</p></div><button className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex max-h-[72vh] justify-center overflow-auto rounded-2xl bg-carbon/80 p-4"><div className="origin-top scale-[.55] sm:scale-[.68] md:scale-[.72]" style={{ width: 540, height: 960 * .72 }}><CapsuleCard ref={cardRef} period={period} totalMs={data.kpis.totalMs} topArtists={data.topArtists.slice(0, 5)} topTracks={data.topTracks.slice(0, 5)} cover={activeCover} hasDuration={hasDuration} showLogo={showLogo} /></div></div>
        <aside className="space-y-4"><div className="rounded-2xl border border-white/10 bg-carbon/50 p-4"><p className="label">Imagem de capa</p>
          <div className="mb-3 flex flex-wrap gap-2">{option('auto', 'Artista nº 1', autoState !== 'ready')}{option('manual', 'Minha imagem', !cover)}{option('procedural', 'Arte procedural')}</div>
          <p className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
            {autoState === 'loading' && <><LoaderCircle className="h-3.5 w-3.5 animate-spin text-slime" /> Carregando imagem de {topArtist?.name}…</>}
            {autoState === 'ready' && <>Capa automática: <b className="truncate text-white">{topArtist?.name}</b></>}
            {autoState === 'failed' && <>Sem imagem disponível para {topArtist?.name ?? 'o artista nº 1'}; usando arte procedural.</>}
          </p>
          <label className="btn-secondary w-full cursor-pointer text-sm"><ImagePlus className="h-4 w-4" /> Escolher imagem<input type="file" accept="image/*" className="hidden" onChange={(event) => selectCover(event.target.files?.[0])} /></label><p className="mt-3 text-xs leading-relaxed text-zinc-500">A imagem escolhida também fica somente nesta aba e não é enviada.</p></div>
          <button type="button" onClick={() => setShowLogo((value) => !value)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-carbon/50 p-4 text-left transition hover:border-white/20 hover:bg-carbon/70" aria-pressed={showLogo}>
            <span className="flex items-center gap-3">{showLogo ? <Eye className="h-5 w-5 text-slime" /> : <EyeOff className="h-5 w-5 text-zinc-500" />}<span><b className="block text-sm text-white">Logo na imagem</b><span className="mt-0.5 block text-xs text-zinc-500">{showLogo ? 'Visível na capa' : 'Oculto na exportação'}</span></span></span>
            <span className={`relative h-6 w-11 rounded-full transition ${showLogo ? 'bg-slime' : 'bg-white/10'}`}><i className={`absolute top-1 h-4 w-4 rounded-full bg-carbon shadow transition ${showLogo ? 'left-6' : 'left-1'}`} /></span>
          </button>
          <button className="btn-primary w-full" disabled={Boolean(working)} onClick={() => void download()}>{working === 'download' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PNG</button>
          <button className="btn-secondary w-full" disabled={Boolean(working)} onClick={() => void copy()}>{working === 'copy' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />} Copiar imagem</button>
          {status && <p className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-xs text-zinc-300"><Check className="h-4 w-4 shrink-0 text-slime" />{status}</p>}
        </aside>
      </div>
    </div>
  </div>;
}
