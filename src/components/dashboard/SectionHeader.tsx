import type { ReactNode } from 'react';

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>{description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}</div>
    {action}
  </div>;
}
