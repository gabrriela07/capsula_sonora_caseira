import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Download, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { toBlob, toPng } from 'html-to-image';
import type { DashboardData, Filters } from '../../types';
import { capsulePeriod, safeFileName } from '../../lib/format';
import { CapsuleCard } from './CapsuleCard';

export function CapsuleModal({ open, onClose, data, filters, hasDuration }: { open: boolean; onClose: () => void; data: DashboardData; filters: Filters; hasDuration: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [working, setWorking] = useState<'download' | 'copy' | null>(null);
  const [status, setStatus] = useState('');
  const period = capsulePeriod(filters);

  useEffect(() => { if (!open) setStatus(''); }, [open]);
  useEffect(() => () => { if (cover?.startsWith('blob:')) URL.revokeObjectURL(cover); }, [cover]);
  if (!open) return null;

  function selectCover(file?: File) {
    if (!file) return;
    if (cover?.startsWith('blob:')) URL.revokeObjectURL(cover);
    setCover(URL.createObjectURL(file));
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

  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm md:p-8" role="dialog" aria-modal="true" aria-label="Pré-visualização da cápsula">
    <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-graphite p-4 shadow-2xl md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Pré-visualização da cápsula</h2><p className="mt-1 text-sm text-zinc-400">A imagem final será exportada em 1080 × 1920 px.</p></div><button className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex max-h-[72vh] justify-center overflow-auto rounded-2xl bg-carbon/80 p-4"><div className="origin-top scale-[.55] sm:scale-[.68] md:scale-[.72]" style={{ width: 540, height: 960 * .72 }}><CapsuleCard ref={cardRef} period={period} totalMs={data.kpis.totalMs} topArtists={data.topArtists.slice(0, 5)} topTracks={data.topTracks.slice(0, 5)} cover={cover} hasDuration={hasDuration} /></div></div>
        <aside className="space-y-4"><div className="rounded-2xl border border-white/10 bg-carbon/50 p-4"><p className="label">Imagem de capa</p><label className="btn-secondary w-full cursor-pointer text-sm"><ImagePlus className="h-4 w-4" /> Escolher imagem<input type="file" accept="image/*" className="hidden" onChange={(event) => selectCover(event.target.files?.[0])} /></label>{cover && <button className="mt-2 w-full text-xs font-semibold text-zinc-400 hover:text-white" onClick={() => setCover(null)}>Usar arte procedural</button>}<p className="mt-3 text-xs leading-relaxed text-zinc-500">A imagem escolhida também fica somente nesta aba e não é enviada.</p></div>
          <button className="btn-primary w-full" disabled={Boolean(working)} onClick={() => void download()}>{working === 'download' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PNG</button>
          <button className="btn-secondary w-full" disabled={Boolean(working)} onClick={() => void copy()}>{working === 'copy' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />} Copiar imagem</button>
          {status && <p className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-xs text-zinc-300"><Check className="h-4 w-4 shrink-0 text-slime" />{status}</p>}
        </aside>
      </div>
    </div>
  </div>;
}
