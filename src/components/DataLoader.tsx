import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Database, Download, Hourglass, LockKeyhole, Bug, Radio, FileUp, Ghost, UserRound } from 'lucide-react';
import { analytics } from '../lib/duckdb';
import { detectMapping, requiredMappingComplete } from '../lib/columnDetection';
import { baixarScrobbles, buscarDuracoes, buscarGeneros, chaveArtista, chaveFaixa, LASTFM_ENV_USER, type Scrobble } from '../lib/lastfm';
import { useAppStore } from '../store/useAppStore';
import logo from '../assets/logo.png';

const USER_KEY = 'capsula:lastfm:user';
// O carregamento automático do servidor acontece só uma vez por sessão,
// para "Trocar dados" voltar a esta tela sem recarregar sozinho.
let serverAutoLoadDone = false;

interface ServerStatus {
  user: string;
  scrobbles: number;
  running: boolean;
  phase: 'idle' | 'scrobbles' | 'durations' | 'genres';
  done: number;
  total: number;
  lastSyncAt: string | null;
  lastError: string | null;
}
const PHASE_LABELS: Record<ServerStatus['phase'], string> = {
  idle: 'Aguardando',
  scrobbles: 'baixando scrobbles do Last.fm',
  durations: 'buscando a duração das músicas',
  genres: 'buscando os gêneros dos artistas',
};

async function fetchServerStatus(): Promise<ServerStatus | null> {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
    return await res.json() as ServerStatus;
  } catch {
    return null;
  }
}

/** Baixa o histórico pronto do servidor, informando os bytes recebidos. */
async function fetchServerHistory(signal: AbortSignal, onBytes: (bytes: number) => void): Promise<File> {
  const res = await fetch('/api/history.csv', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`O servidor respondeu ${res.status} ao exportar o histórico.`);
  if (!res.body) return new File([await res.blob()], 'lastfm-servidor.csv', { type: 'text/csv' });
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.length;
    onBytes(bytes);
  }
  return new File(chunks, 'lastfm-servidor.csv', { type: 'text/csv' });
}

const megabytes = (bytes: number) => `${(bytes / 1_048_576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
// Usada só se o Last.fm não informar a duração de nenhuma faixa
const FALLBACK_DURATION_MS = 210_000;

interface Progress {
  step: number; // 0 = importação de arquivo (sem etapas)
  steps?: number; // total de etapas (padrão 4)
  label: string;
  done: number;
  total: number;
  skippable?: boolean;
}

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function median(values: number[]): number {
  if (!values.length) return FALLBACK_DURATION_MS;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function scrobblesToFile(rows: Scrobble[], durations: Map<string, number>, genres: Map<string, string>): File {
  // Faixas sem duração no Last.fm recebem a mediana das conhecidas (estimativa)
  const fallback = median([...durations.values()].filter((ms) => ms > 0));
  const header = 'artist,artist_mbid,album,album_mbid,track,track_mbid,image_url,lastfm_url,streamable,date_1,uts,duration_ms,duration_estimated,genre';
  const body = rows.map((row) => {
    const duration = durations.get(chaveFaixa(row.artist, row.track)) || fallback;
    return [
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
      csvCell(duration),
      csvCell('1'),
      csvCell(genres.get(chaveArtista(row.artist)) ?? ''),
    ].join(',');
  }).join('\n');
  return new File([`${header}\n${body}`], 'lastfm-api.csv', { type: 'text/csv;charset=utf-8' });
}

function LoadingPanel({ progress, onCancel, onSkip }: { progress: Progress; onCancel?: () => void; onSkip?: () => void }) {
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  return <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-white/10 bg-carbon/50 p-8 text-center" role="status" aria-live="polite">
    <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
      <span className="absolute inset-0 animate-ping rounded-full bg-slime/15" style={{ animationDuration: '2.2s' }} />
      <span className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-petal border-t-slime" style={{ animationDuration: '1.4s' }} />
      <img src={logo} alt="" className="relative h-16 w-16 animate-pulse object-contain" />
    </div>
    {progress.step > 0 && <p className="text-xs font-bold uppercase tracking-[0.2em] text-slime">Etapa {progress.step} de {progress.steps ?? 4}</p>}
    <p className="mt-2 font-bold text-white">{progress.label}</p>
    {progress.total > 0 && <p className="mt-1 text-sm text-zinc-400">{progress.done.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')} · {pct}%</p>}
    <div className="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
      {progress.total > 0
        ? <div className="h-full rounded-full bg-gradient-to-r from-slime via-banana to-petal transition-all duration-500" style={{ width: `${pct}%` }} />
        : <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-slime via-banana to-petal" />}
    </div>
    {progress.skippable && <p className="mt-4 max-w-md text-xs leading-relaxed text-zinc-500">Na primeira vez esta etapa pode demorar; os resultados ficam em cache no navegador e as próximas cargas são rápidas.</p>}
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {progress.skippable && onSkip && <button type="button" className="btn-secondary" onClick={onSkip}>Pular esta etapa</button>}
      {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>}
    </div>
  </div>;
}

export function DataLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipRef = useRef(false);
  const setProfile = useAppStore((state) => state.setProfile);
  const [user, setUser] = useState(() => localStorage.getItem(USER_KEY) ?? LASTFM_ENV_USER);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [server, setServer] = useState<ServerStatus | null>(null);

  // Verifica se o site está rodando junto com o servidor (MySQL)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      const status = await fetchServerStatus();
      if (cancelled) return;
      setServer(status);
      if (!status) return;
      if (status.scrobbles > 0 && !serverAutoLoadDone) {
        serverAutoLoadDone = true;
        void loadFromServer();
        return;
      }
      // Primeira sincronização ainda sem dados: consulta de novo em 5 s
      if (status.scrobbles === 0) timer = setTimeout(() => void check(), 5000);
    }
    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setProgress({ step: 0, label: 'Lendo e preparando o arquivo…', done: 0, total: 0 });
    setLoading(true);
    try {
      const profile = await prepareFile(file);
      setProfile(profile);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível abrir este arquivo.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function loadFromServer() {
    setMessage('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setProgress({ step: 1, steps: 2, label: 'Baixando histórico do servidor', done: 0, total: 0 });
      const file = await fetchServerHistory(controller.signal, (bytes) => setProgress({ step: 1, steps: 2, label: `Baixando histórico do servidor · ${megabytes(bytes)}`, done: 0, total: 0 }));
      setProgress({ step: 2, steps: 2, label: 'Preparando as reproduções no DuckDB', done: 0, total: 0 });
      const profile = await prepareFile(file);
      setProfile(profile);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') setMessage('Importação cancelada.');
      else setMessage(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados do servidor.');
    } finally {
      abortRef.current = null;
      setLoading(false);
      setProgress(null);
    }
  }

  async function connectLastFm(username: string) {
    setMessage('');
    setLoading(true);
    localStorage.setItem(USER_KEY, username);
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    try {
      setProgress({ step: 1, label: 'Baixando histórico do Last.fm', done: 0, total: 0 });
      const rows = await baixarScrobbles({
        user: username,
        signal,
        onProgress: (done, total) => setProgress({ step: 1, label: 'Baixando histórico do Last.fm', done, total }),
      });
      if (!rows.length) throw new Error('O Last.fm não retornou scrobbles para esse usuário.');

      const tracks = new Map<string, { artist: string; track: string }>();
      rows.forEach((row) => tracks.set(chaveFaixa(row.artist, row.track), { artist: row.artist, track: row.track }));
      skipRef.current = false;
      const durations = await buscarDuracoes([...tracks.values()], {
        signal,
        deveParar: () => skipRef.current,
        onProgress: (done, total) => setProgress({ step: 2, label: 'Buscando a duração das músicas', done, total, skippable: true }),
      });

      const artists = [...new Set(rows.map((row) => row.artist))];
      skipRef.current = false;
      const genres = await buscarGeneros(artists, {
        signal,
        deveParar: () => skipRef.current,
        onProgress: (done, total) => setProgress({ step: 3, label: 'Buscando os gêneros dos artistas', done, total, skippable: true }),
      });

      setProgress({ step: 4, label: `Preparando ${rows.length.toLocaleString('pt-BR')} reproduções no DuckDB`, done: 0, total: 0 });
      const profile = await prepareFile(scrobblesToFile(rows, durations, genres));
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
      setProgress(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = user.trim();
    if (!username || loading) return;
    void connectLastFm(username);
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
        {loading && progress ? <LoadingPanel
          progress={progress}
          onCancel={abortRef.current ? () => abortRef.current?.abort() : undefined}
          onSkip={() => { skipRef.current = true; }}
        /> : <>
          {server && <div className="mb-5">
            <button type="button" onClick={() => void loadFromServer()} disabled={loading || server.scrobbles === 0} className="group flex w-full items-center gap-4 rounded-2xl border border-petal/30 bg-petal/10 p-5 text-left transition hover:border-petal hover:bg-petal/15 disabled:cursor-not-allowed disabled:opacity-60">
              <span className="rounded-xl bg-petal p-3 text-carbon"><Database className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-lg text-white">Carregar do servidor</strong><span className="mt-1 block text-sm text-zinc-400">{server.scrobbles > 0 ? `${server.scrobbles.toLocaleString('pt-BR')} scrobbles de ${server.user}${server.lastSyncAt ? ` · sincronizado em ${new Date(server.lastSyncAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}` : 'Primeira sincronização em andamento…'}</span></span>
            </button>
            {server.running && <p className="mt-2 text-xs text-zinc-500">Servidor {PHASE_LABELS[server.phase]}{server.total ? ` · ${server.done.toLocaleString('pt-BR')} de ${server.total.toLocaleString('pt-BR')}` : ''}</p>}
            {server.lastError && <p className="mt-2 text-xs text-red-300">Última sincronização falhou: {server.lastError}</p>}
            <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-600"><span className="h-px flex-1 bg-white/10" />ou<span className="h-px flex-1 bg-white/10" /></div>
          </div>}
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="label">Usuário do Last.fm</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                <input className="field pl-9" value={user} onChange={(event) => setUser(event.target.value)} placeholder="seu_usuario" autoComplete="username" spellCheck={false} autoFocus />
              </div>
            </label>
            <button type="submit" className="group flex w-full items-center gap-4 rounded-2xl border border-slime/30 bg-slime/10 p-5 text-left transition hover:border-slime hover:bg-slime/15 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading || !user.trim()}>
              <span className="rounded-xl bg-slime p-3 text-carbon"><Radio className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-lg text-white">Conectar ao Last.fm</strong><span className="mt-1 block text-sm text-zinc-400">Chave api em .env</span></span>
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-600"><span className="h-px flex-1 bg-white/10" />ou<span className="h-px flex-1 bg-white/10" /></div>
          <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => !loading && inputRef.current?.click()} className={`group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-slime bg-slime/10' : 'border-white/15 bg-carbon/40 hover:border-slime/50 hover:bg-carbon/70'}`}>
            {loading ? <><Hourglass className="h-11 w-11 animate-pulse text-slime" /><p className="mt-5 font-bold">Preparando dados…</p></> : <><div className="rounded-full bg-white/5 p-5 transition group-hover:scale-105"><FileUp className="h-9 w-9 text-slime" /></div><p className="mt-5 text-lg font-bold">Importar CSV ou Parquet</p><p className="mt-2 text-sm text-zinc-400">Arraste o arquivo ou clique para escolher</p></>}
            <input ref={inputRef} type="file" accept=".csv,.parquet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void choose(file); event.currentTarget.value = ''; }} />
          </div>
        </>}
        {message && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-200">{message}</p>}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row"><div className="text-sm text-zinc-400">Reconhecimento automático: artist, album, track e date_1</div><a href="/sample.csv" download className="btn-secondary text-sm"><Download className="h-4 w-4" /> Baixar sample.csv</a></div>
      </section>
      <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-sm text-zinc-400 sm:grid-cols-3"><div className="flex items-center justify-center gap-2 text-center"><LockKeyhole className="h-4 w-4 shrink-0 text-slime" /> 0 segurança </div><div className="flex items-center justify-center gap-2 text-center"><Bug className="h-4 w-4 shrink-0 text-petal" /> Feito toscamente por:</div><div className="flex items-center justify-center gap-2 text-center"><Ghost className="h-4 w-4 shrink-0 text-banana" /> github/gabrriela07</div></div>
    </div>
  </main>;
}
