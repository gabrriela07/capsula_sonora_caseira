import { AlertTriangle, DatabaseZap, LoaderCircle, Music2 } from 'lucide-react';

export function LoadingState({ label = 'Consultando seu histórico local…' }: { label?: string }) {
  return <div className="panel flex min-h-72 flex-col items-center justify-center gap-4 text-center">
    <LoaderCircle className="h-10 w-10 animate-spin text-slime" />
    <div><p className="font-semibold text-white">{label}</p><p className="mt-1 text-sm text-zinc-400">Arquivos grandes podem levar alguns instantes.</p></div>
  </div>;
}

export function EmptyState() {
  return <div className="panel flex min-h-64 flex-col items-center justify-center gap-3 text-center">
    <div className="rounded-full bg-white/5 p-4"><Music2 className="h-8 w-8 text-banana" /></div>
    <div><p className="font-semibold">Nada para mostrar neste período</p><p className="mt-1 max-w-md text-sm text-zinc-400">Tente ampliar as datas, remover artista/álbum ou reduzir o tempo mínimo.</p></div>
  </div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="panel border-red-400/25 bg-red-950/20">
    <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><div><p className="font-semibold text-red-100">Não foi possível concluir</p><p className="mt-1 text-sm text-red-200/80">{message}</p>{onRetry && <button onClick={onRetry} className="mt-4 text-sm font-bold text-slime hover:underline">Tentar novamente</button>}</div></div>
  </div>;
}

export function InitializingState() {
  return <div className="flex min-h-screen items-center justify-center bg-carbon p-6"><div className="text-center"><DatabaseZap className="mx-auto h-11 w-11 animate-pulse text-slime" /><p className="mt-4 font-semibold">Preparando o mecanismo local…</p></div></div>;
}
