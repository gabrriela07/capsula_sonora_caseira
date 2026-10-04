import { useRef, useState, type DragEvent } from 'react';
import { Download, Hourglass, LockKeyhole, UploadCloud, Bird, Bug, Radio, FileUp,Ghost } from 'lucide-react';
import { analytics } from '../lib/duckdb';
import { detectMapping, requiredMappingComplete } from '../lib/columnDetection';
import { baixarScrobbles, type Scrobble } from '../lib/lastfm';
import { useAppStore } from '../store/useAppStore';
import logo from '../assets/logo.png';

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function scrobblesToFile(rows: Scrobble[]): File {
  const header = 'artist,artist_mbid,album,album_mbid,track,track_mbid,image_url,lastfm_url,streamable,date_1,uts';
  const body = rows.map((row) => [
    csvCell(row.artist),
    csvCell(row.artist_mbid),
    csvCell(row.album),
    csvCell(row.album_mbid),
    csvCell(row.track),
    csvCell(row.track_mbid),
    csvCell(row.image_url),
    csvCell(row.lastfm_url),
    csvCell(row.streamable ? '1' : '0'),
    csvCell(row.date_1),
    csvCell(row.uts),
  ].join(',')).join('\n');
  return new File([`${header}\n${body}`], 'lastfm-api.csv', { type: 'text/csv;charset=utf-8' });
}

export function DataLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setProfile = useAppStore((state) => state.setProfile);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');

  async function prepareFile(file: File) {
    const schema = await analytics.inspectFile(file);
    const mapping = detectMapping(schema);
    if (!requiredMappingComplete(mapping)) {
      const found = schema.map((column) => column.name).join(', ');
      throw new Error(`O arquivo precisa conter artist, track e date_1. Colunas encontradas: ${found}`);
    }
    return analytics.normalize(mapping, file.name);
  }

  async function choose(file: File) {
    setMessage('');
    setProgress('Lendo e preparando o arquivo…');
    setLoading(true);
    try {
      const profile = await prepareFile(file);
      setProfile(profile);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível abrir este arquivo.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  async function connectLastFm() {
    setMessage('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const rows = await baixarScrobbles({
        signal: controller.signal,
        onProgress: (done, total) => setProgress(`Baixando histórico do Last.fm: ${done} de ${total} páginas…`),
      });
      if (!rows.length) throw new Error('O Last.fm não retornou scrobbles para esse usuário.');
      setProgress(`Preparando ${rows.length.toLocaleString('pt-BR')} reproduções no DuckDB…`);
      const profile = await prepareFile(scrobblesToFile(rows));
      setProfile(profile);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setMessage('Importação cancelada.');
      } else {
        setMessage(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados do Last.fm.');
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      setProgress('');
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void choose(file);
  }

  return <main className="relative min-h-screen overflow-hidden bg-carbon px-4 py-10 md:px-8 md:py-16">
    <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[520px] w-[520px] rounded-full bg-slime/10 blur-[120px]" />
    <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[480px] w-[480px] rounded-full bg-petal/10 blur-[120px]" />
    <div className="relative mx-auto max-w-5xl">
      <header className="mb-10 text-center">
        <div className="mx-auto mb-5 flex items-center justify-center">
      <img
        src={logo}
        alt="Cápsula Sonora"
        className="h-24 w-auto object-contain md:h-32"
      />
</div>
        <h1 className="text-4xl font-extrabold tracking-[-0.04em] text-white md:text-6xl">CÁPSULA SONORA <span className="text-petal">CASEIRA</span><span className="text-slime">.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">Ato de rebeldia contra certa empresa de streaming musical</p>
      </header>

      <section className="panel mx-auto max-w-3xl p-5 md:p-8">
        <button type="button" className="group flex w-full items-center gap-4 rounded-2xl border border-slime/30 bg-slime/10 p-5 text-left transition hover:border-slime hover:bg-slime/15 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void connectLastFm()} disabled={loading}>
          <span className="rounded-xl bg-slime p-3 text-carbon"><Radio className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-lg text-white">Conectar ao Last.fm</strong><span className="mt-1 block text-sm text-zinc-400">Chave api em .env</span></span>
        </button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-600"><span className="h-px flex-1 bg-white/10" />ou<span className="h-px flex-1 bg-white/10" /></div>

        <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => !loading && inputRef.current?.click()} className={`group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-slime bg-slime/10' : 'border-white/15 bg-carbon/40 hover:border-slime/50 hover:bg-carbon/70'}`}>
          {loading ? <><Hourglass className="h-11 w-11 animate-pulse text-slime" /><p className="mt-5 font-bold">{progress || 'Preparando dados…'}</p>{abortRef.current && <button type="button" className="btn-secondary mt-4" onClick={(event) => { event.stopPropagation(); abortRef.current?.abort(); }}>Cancelar</button>}</> : <><div className="rounded-full bg-white/5 p-5 transition group-hover:scale-105"><FileUp className="h-9 w-9 text-slime" /></div><p className="mt-5 text-lg font-bold">Importar CSV ou Parquet</p><p className="mt-2 text-sm text-zinc-400">Arraste o arquivo ou clique para escolher</p></>}
          <input ref={inputRef} type="file" accept=".csv,.parquet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void choose(file); event.currentTarget.value = ''; }} />
        </div>

        {message && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-200">{message}</p>}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row"><div className="text-sm text-zinc-400">Reconhecimento automático: artist, album, track e date_1</div><a href="/sample.csv" download className="btn-secondary text-sm"><Download className="h-4 w-4" /> Baixar sample.csv</a></div>
      </section>

      <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-sm text-zinc-400 sm:grid-cols-3"><div className="flex items-center justify-center gap-2 text-center"><LockKeyhole className="h-4 w-4 shrink-0 text-slime" /> 0 segurança </div><div className="flex items-center justify-center gap-2 text-center"><Bug className="h-4 w-4 shrink-0 text-petal" /> Feito toscamente por:</div><div className="flex items-center justify-center gap-2 text-center"><Ghost className="h-4 w-4 shrink-0 text-banana" /> github/gabrriela07</div></div>
    </div>
  </main>;
}
