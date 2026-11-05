import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Link2, UserRound } from 'lucide-react';
import { getLastFmUser, setLastFmUser, shareLink } from '../../lib/apiUser';

/** Selo com o usuário atual do Last.fm + troca de usuário e link compartilhável. */
export function LastFmUserSwitch() {
  const [atual, setAtual] = useState(getLastFmUser());
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(atual);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (atual) return;
    // Sem usuário salvo: mostra o padrão do servidor, se houver
    fetch('/api/config').then((r) => r.json()).then((cfg: { defaultUser?: string | null }) => {
      if (cfg.defaultUser) { setAtual(cfg.defaultUser); setValor(cfg.defaultUser); } else setAberto(true);
    }).catch(() => {});
  }, [atual]);

  useEffect(() => {
    const fechar = (event: MouseEvent) => { if (caixa.current && !caixa.current.contains(event.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  function confirmar(event: FormEvent) {
    event.preventDefault();
    if (!setLastFmUser(valor)) setErro('Use 2 a 32 caracteres: letras, números, _ ou -.');
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(shareLink(atual)); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sem clipboard */ }
  }

  return <div ref={caixa} className="relative">
    <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-slime/50 hover:text-white">
      <UserRound className="h-3.5 w-3.5 text-slime" />
      <span className="max-w-[140px] truncate">{atual || 'Escolher usuário'}</span>
    </button>
    {aberto && <form onSubmit={confirmar} className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-white/10 bg-[#242426]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,.6)] backdrop-blur-xl">
      <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400">Usuário do Last.fm</label>
      <input autoFocus value={valor} onChange={(e) => { setValor(e.target.value); setErro(''); }} placeholder="seu_usuario" className="field mb-2" />
      {erro && <p className="mb-2 text-[11px] text-petal">{erro}</p>}
      <p className="mb-3 text-[11px] text-zinc-500">Na primeira vez, o histórico é baixado do Last.fm e pode levar alguns minutos.</p>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => void copiar()} disabled={!atual} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white disabled:opacity-40">
          {copiado ? <Check className="h-3.5 w-3.5 text-slime" /> : <Link2 className="h-3.5 w-3.5" />} {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
        <button type="submit" className="rounded-full bg-slime px-4 py-2 text-xs font-extrabold text-carbon">Abrir cápsula</button>
      </div>
    </form>}
  </div>;
}
