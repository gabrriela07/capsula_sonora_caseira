import { ArrowLeftRight } from 'lucide-react';

export function ComparisonNote() {
  return <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400" title="Cada percentual compara o período atual ao intervalo imediatamente anterior, com a mesma quantidade de dias.">
    <ArrowLeftRight className="h-3.5 w-3.5 text-petal" /> vs. período anterior
  </div>;
}
