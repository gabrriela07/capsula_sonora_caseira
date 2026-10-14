import { Database, Images, LayoutDashboard, RotateCcw, Sparkles } from 'lucide-react';
import type { DataProfile } from '../../types';
import { compactBR } from '../../lib/format';
import logo from '../../assets/logo.png';

export type DashboardView = 'dashboard' | 'lastfm';

interface Props {
  profile: DataProfile;
  onCapsule: () => void;
  onReset: () => void;
  capsuleDisabled?: boolean;
  activeView?: DashboardView;
  onViewChange?: (view: DashboardView) => void;
}

export function Header({ profile, onCapsule, onReset, capsuleDisabled = false, activeView = 'dashboard', onViewChange }: Props) {
  return <header className="sticky top-0 z-40 border-b border-white/10 bg-carbon/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <img src={logo} alt="Cápsula Sonora" className="h-10 w-auto shrink-0 object-contain md:h-11" />
        <div className="min-w-0">
          <h1 className="truncate font-extrabold tracking-tight">Cápsula Sonora</h1>
          <p className="flex items-center gap-1.5 truncate text-xs text-zinc-500"><Database className="h-3 w-3" />{profile.fileName} · {compactBR.format(profile.validRows)} linhas</p>
        </div>
      </div>

      {onViewChange && <nav className="order-3 flex w-full items-center justify-center rounded-full border border-white/10 bg-black/20 p-1 sm:order-none sm:w-auto" aria-label="Páginas do dashboard">
        <button className={`view-tab flex-1 sm:flex-none ${activeView === 'dashboard' ? 'view-tab-active' : ''}`} onClick={() => onViewChange('dashboard')}>
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </button>
        <button className={`view-tab flex-1 sm:flex-none ${activeView === 'lastfm' ? 'view-tab-active' : ''}`} onClick={() => onViewChange('lastfm')}>
          <Images className="h-4 w-4" /> Last.fm one page
        </button>
      </nav>}

      <div className="flex shrink-0 items-center gap-2">
        <button className="btn-secondary hidden sm:inline-flex" onClick={onReset} title="Carregar outro arquivo"><RotateCcw className="h-4 w-4" /> Trocar dados</button>
        <button className="btn-primary px-4 py-2.5 text-sm" disabled={capsuleDisabled} onClick={onCapsule}><Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Gerar </span>Cápsula</button>
      </div>
    </div>
  </header>;
}
