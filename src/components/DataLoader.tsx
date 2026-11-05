import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Database, Download, Hourglass, LockKeyhole, Bug, Radio, FileUp, Ghost, UserRound, RotateCcw, ChevronRight } from 'lucide-react';
import { analytics } from '../lib/duckdb';
import { detectMapping, requiredMappingComplete } from '../lib/columnDetection';
import { baixarScrobbles, buscarDuracoes, buscarGeneros, chaveArtista, chaveFaixa, LASTFM_ENV_USER, type Scrobble } from '../lib/lastfm';
import { useAppStore } from '../store/useAppStore';
import logo from '../assets/logo.png';

const USER_KEY = 'capsula:lastfm:user';
// O carregamento automático do servidor acontece só uma vez por sessão,
// para "Trocar dados" voltar a esta tela sem recarregar sozinho.
let serverAutoLoadDone = false;

// Ao abrir, a API pode ainda estar subindo (npm run dev / Render acordando).
// Tentamos de novo por até ~45 s antes de mostrar as opções manuais.
const BOOT_RETRY_MS = 1500;
const BOOT_MAX_ATTEMPTS = 30;

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

type StatusResult = { kind: 'ok'; status: ServerStatus } | { kind: 'offline' } | { kind: 'no-user' };

async function fetchServerStatus(): Promise<StatusResult> {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const json = res.headers.get('content-type')?.includes('application/json');
    // API no ar, mas sem usuário válido: não adianta insistir
    if ((res.status === 400 || res.status === 403 || res.status === 404) && json) return { kind: 'no-user' };
    if (!res.ok || !json) return { kind: 'offline' };
    return { kind: 'ok', status: await res.json() as ServerStatus };
  } catch {
    return { kind: 'offline' };
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

/* ---------- Animações (CSS local, sem mexer no index.css) ---------- */

const LANDING_CSS = `
@keyframes cs-eq { 0%,100% { transform: scaleY(.25) } 50% { transform: scaleY(1) } }
@keyframes cs-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
@keyframes cs-spin-slow { to { transform: rotate(360deg) } }
@keyframes cs-fade-up { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes cs-shimmer { from { transform: translateX(-100%) } to { transform: translateX(250%) } }
.cs-eq-bar { transform-origin: bottom; animation: cs-eq 1.1s ease-in-out infinite; }
.cs-float { animation: cs-float 6s ease-in-out infinite; }
.cs-vinyl { animation: cs-spin-slow 14s linear infinite; }
.cs-fade-up { animation: cs-fade-up .6s ease-out both; }
.cs-shimmer { animation: cs-shimmer 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cs-eq-bar, .cs-float, .cs-vinyl, .cs-fade-up, .cs-shimmer { animation: none !important; }
}
`;

const EQ_COLORS = ['bg-slime', 'bg-banana', 'bg-petal', 'bg-slime', 'bg-banana', 'bg-petal', 'bg-slime'];

function Equalizer({ bars = 7, className = 'h-8' }: { bars?: number; className?: string }) {
  return <div className={`flex items-end gap-1 ${className}`} aria-hidden="true">
    {Array.from({ length: bars }, (_, index) => <span
      key={index}
      className={`cs-eq-bar block h-full w-1.5 rounded-full ${EQ_COLORS[index % EQ_COLORS.length]}`}
      style={{ animationDelay: `${(index * 0.13) % 0.9}s`, animationDuration: `${0.9 + (index % 3) * 0.2}s` }}
    />)}
  </div>;
}

/** Disco girando com o logo no centro. */
function VinylLogo({ size = 'h-56 w-56 md:h-72 md:w-72' }: { size?: string }) {
  return <div className={`relative ${size}`}>
    <div className="cs-vinyl absolute inset-0 rounded-full border border-white/10 bg-[radial-gradient(circle,#2a2a2d_0%,#141416_38%,#1d1d20_39%,#141416_52%,#1d1d20_53%,#141416_66%,#1d1d20_67%,#101012_100%)] shadow-[0_30px_80px_rgba(0,0,0,.55)]">
      <span className="absolute left-1/2 top-3 h-2 w-2 -translate-x-1/2 rounded-full bg-white/20" />
    </div>
    <div className="absolute inset-[30%] flex items-center justify-center rounded-full bg-carbon ring-4 ring-slime/20">
      <img src={logo} alt="Cápsula Sonora" className="h-[78%] w-[78%] object-contain" />
    </div>
  </div>;
}

/** Tela cheia exibida enquanto a API sobe (primeiro acesso). */
function BootScreen({ attempt }: { attempt: number }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" role="status" aria-live="polite">
    <VinylLogo size="h-40 w-40" />
    <Equalizer className="mt-8 h-10" bars={9} />
    <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-slime">Afinando os instrumentos</p>
    <p className="mt-2 text-lg font-bold text-white">Conectando ao servidor…</p>
    <p className="mt-2 max-w-sm text-sm text-zinc-500">
      {attempt < 4 ? 'Só um instante.' : 'O servidor pode estar acordando. Isso leva até 1 minuto na primeira visita.'}
    </p>
  </div>;
}

function LoadingPanel({ progress, onCancel, onSkip }: { progress: Progress; onCancel?: () => void; onSkip?: () => void }) {
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const steps = progress.steps ?? 4;
  return <div className="flex min-h-80 flex-col items-center justify-center p-4 text-center" role="status" aria-live="polite">
    <VinylLogo size="h-32 w-32" />
    <Equalizer className="mt-6 h-8" />
    {progress.step > 0 && <div className="mt-6 flex items-center gap-2">
      {Array.from({ length: steps }, (_, index) => <span key={index} className={`h-1.5 rounded-full transition-all duration-500 ${index + 1 < progress.step ? 'w-6 bg-slime' : index + 1 === progress.step ? 'w-10 bg-gradient-to-r from-slime to-banana' : 'w-6 bg-white/10'}`} />)}
    </div>}
    {progress.step > 0 && <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-slime">Etapa {progress.step} de {steps}</p>}
    <p className="mt-2 font-bold text-white">{progress.label}</p>
    {progress.total > 0 && <p className="mt-1 text-sm text-zinc-400">{progress.done.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')} · {pct}%</p>}
    <div className="relative mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
      {progress.total > 0
        ? <div className="h-full rounded-full bg-gradient-to-r from-slime via-banana to-petal transition-all duration-500" style={{ width: `${pct}%` }} />
        : <div className="cs-shimmer absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-slime via-banana to-petal" />}
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
  const [booting, setBooting] = useState(true);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [checkKey, setCheckKey] = useState(0);

  // Verifica se o site está rodando junto com o servidor (MySQL), com novas tentativas na largada
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setBooting(true);

    async function check() {
      const result = await fetchServerStatus();
      if (cancelled) return;
      attempts += 1;
      setBootAttempt(attempts);

      if (result.kind === 'offline') {
        if (attempts < BOOT_MAX_ATTEMPTS) { timer = setTimeout(() => void check(), BOOT_RETRY_MS); return; }
        setServer(null);
        setBooting(false);
        return;
      }
      if (result.kind === 'no-user') { setServer(null); setBooting(false); return; }

      const status = result.status;
      setServer(status);
      if (status.scrobbles > 0 && !serverAutoLoadDone) {
        serverAutoLoadDone = true;
        setBooting(false);
        void loadFromServer();
        return;
      }
      setBooting(false);
      // Primeira sincronização ainda sem dados: consulta de novo em 5 s
      if (status.scrobbles === 0) timer = setTimeout(() => void check(), 5000);
    }

    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkKey]);

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

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void choose(file);
  }

  const syncInfo = server && server.scrobbles > 0
    ? `${server.scrobbles.toLocaleString('pt-BR')} scrobbles de ${server.user}${server.lastSyncAt ? ` · sincronizado em ${new Date(server.lastSyncAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}`
    : 'Primeira sincronização em andamento…';

  return <main
    className="relative flex min-h-screen flex-col overflow-hidden bg-carbon"
    onDragOver={(event) => { if (!loading) { event.preventDefault(); setDragging(true); } }}
    onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
    onDrop={drop}
  >
    <style>{LANDING_CSS}</style>

    {/* Fundo: brilhos e grade sutil */}
    <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[520px] w-[520px] rounded-full bg-slime/10 blur-[120px]" />
    <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[480px] w-[480px] rounded-full bg-petal/10 blur-[120px]" />
    <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:48px_48px]" />

    {/* Arraste em qualquer lugar da página */}
    {dragging && <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-carbon/80 backdrop-blur-sm">
      <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-slime bg-slime/5 px-16 py-12">
        <FileUp className="h-12 w-12 text-slime" />
        <p className="mt-4 text-lg font-bold">Importar CSV ou Parquet</p>
        <p className="mt-1 text-sm text-zinc-400">Solte o arquivo para começar</p>
      </div>
    </div>}

    <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
      {booting && !loading ? <BootScreen attempt={bootAttempt} /> : <div className="grid flex-1 items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">

        {/* Hero */}
        <section className="cs-fade-up text-center lg:text-left">
          <div className="cs-float mx-auto mb-8 w-fit lg:mx-0"><VinylLogo /></div>
          <Equalizer className="mx-auto mb-5 h-6 lg:mx-0" />
          <h1 className="text-4xl font-extrabold tracking-[-0.04em] text-white md:text-6xl">CÁPSULA SONORA <span className="text-petal">CASEIRA</span><span className="text-slime">.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg lg:mx-0">Ato de rebeldia contra certa empresa de streaming musical</p>
        </section>

        {/* Cartão de ações */}
        <section className="cs-fade-up panel relative overflow-hidden p-5 md:p-7" style={{ animationDelay: '.15s' }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slime/60 to-transparent" />

          {loading && progress ? <LoadingPanel
            progress={progress}
            onCancel={abortRef.current ? () => abortRef.current?.abort() : undefined}
            onSkip={() => { skipRef.current = true; }}
          /> : <>
            {server && <div className="mb-5">
              <button type="button" onClick={() => void loadFromServer()} disabled={loading || server.scrobbles === 0} className="group flex w-full items-center gap-4 rounded-2xl border border-petal/30 bg-petal/10 p-5 text-left transition hover:-translate-y-0.5 hover:border-petal hover:bg-petal/15 hover:shadow-[0_12px_40px_rgba(0,0,0,.35)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
                <span className="rounded-xl bg-petal p-3 text-carbon"><Database className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-lg text-white">Carregar do servidor</strong><span className="mt-1 block text-sm text-zinc-400">{syncInfo}</span></span>
                <ChevronRight className="h-5 w-5 shrink-0 text-petal transition group-hover:translate-x-1" />
              </button>
              {server.running && <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><Equalizer className="h-3" bars={4} /> Servidor {PHASE_LABELS[server.phase]}{server.total ? ` · ${server.done.toLocaleString('pt-BR')} de ${server.total.toLocaleString('pt-BR')}` : ''}</p>}
              {server.lastError && <p className="mt-2 text-xs text-red-300">Última sincronização falhou: {server.lastError}</p>}
              <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-600"><span className="h-px flex-1 bg-white/10" />ou<span className="h-px flex-1 bg-white/10" /></div>
            </div>}

            {!server && <button type="button" onClick={() => setCheckKey((key) => key + 1)} className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:text-white">
              <RotateCcw className="h-3.5 w-3.5" /> Servidor indisponível · tentar novamente
            </button>}

            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="label">Usuário do Last.fm</span>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                  <input className="field pl-9" value={user} onChange={(event) => setUser(event.target.value)} placeholder="seu_usuario" autoComplete="username" spellCheck={false} autoFocus />
                </div>
              </label>
              <button type="submit" className="group flex w-full items-center gap-4 rounded-2xl border border-slime/30 bg-slime/10 p-5 text-left transition hover:-translate-y-0.5 hover:border-slime hover:bg-slime/15 hover:shadow-[0_12px_40px_rgba(0,0,0,.35)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" disabled={loading || !user.trim()}>
                <span className="rounded-xl bg-slime p-3 text-carbon"><Radio className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-lg text-white">Conectar ao Last.fm</strong><span className="mt-1 block text-sm text-zinc-400">Chave api em .env</span></span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slime transition group-hover:translate-x-1" />
              </button>
            </form>

            {/* Importação compacta (antes era a caixa grande) */}
            <button type="button" onClick={() => !loading && inputRef.current?.click()} className="group mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 py-3 text-left text-sm transition hover:border-slime/50 hover:bg-white/5">
              {loading ? <Hourglass className="h-4 w-4 animate-pulse text-slime" /> : <FileUp className="h-4 w-4 text-slime" />}
              <span className="min-w-0 flex-1"><strong className="text-white">{loading ? 'Preparando dados…' : 'Importar CSV ou Parquet'}</strong><span className="ml-2 hidden text-zinc-500 sm:inline">Arraste o arquivo ou clique para escolher</span></span>
            </button>
            <input ref={inputRef} type="file" accept=".csv,.parquet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void choose(file); event.currentTarget.value = ''; }} />
          </>}

          {message && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-200">{message}</p>}

          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <div className="text-xs text-zinc-500">Reconhecimento automático: artist, album, track e date_1</div>
            <a href="/sample.csv" download className="btn-secondary text-sm"><Download className="h-4 w-4" /> Baixar sample.csv</a>
          </div>
        </section>
      </div>}

      {/* Rodapé (preservado) */}
      <footer className="mx-auto mt-12 grid w-full max-w-3xl gap-3 border-t border-white/5 pt-6 text-sm text-zinc-400 sm:grid-cols-3">
        <div className="flex items-center justify-center gap-2 text-center"><LockKeyhole className="h-4 w-4 shrink-0 text-slime" /> 0 segurança </div>
        <div className="flex items-center justify-center gap-2 text-center"><Bug className="h-4 w-4 shrink-0 text-petal" /> Feito toscamente por:</div>
        <div className="flex items-center justify-center gap-2 text-center"><Ghost className="h-4 w-4 shrink-0 text-banana" /> github/gabrriela07</div>
      </footer>
    </div>
  </main>;
}
