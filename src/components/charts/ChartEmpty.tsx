export function ChartEmpty({ label = 'Sem dados suficientes' }: { label?: string }) {
  return <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">{label}</div>;
}
