import { Database, Hourglass, RotateCcw, Sparkles } from 'lucide-react';
import type { DataProfile } from '../../types';
import { compactBR } from '../../lib/format';

export function Header({ profile, onCapsule, onReset, capsuleDisabled = false }: { profile: DataProfile; onCapsule: () => void; onReset: () => void; capsuleDisabled?: boolean }) {
  return <header className="sticky top-0 z-30 border-b border-white/10 bg-carbon/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-8">
      <div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-slime p-2 text-carbon"><Hourglass className="h-5 w-5" /></div><div className="min-w-0"><h1 className="truncate font-extrabold tracking-tight">Cápsula Sonora</h1><p className="flex items-center gap-1.5 truncate text-xs text-zinc-500"><Database className="h-3 w-3" />{profile.fileName} · {compactBR.format(profile.validRows)} linhas</p></div></div>
      <div className="flex shrink-0 items-center gap-2"><button className="btn-secondary hidden sm:inline-flex" onClick={onReset} title="Carregar outro arquivo"><RotateCcw className="h-4 w-4" /> Trocar dados</button><button className="btn-primary px-4 py-2.5 text-sm" disabled={capsuleDisabled} onClick={onCapsule}><Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Gerar </span>Cápsula</button></div>
    </div>
  </header>;
}
