import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Filters } from '../types';

export const numberBR = new Intl.NumberFormat('pt-BR');
export const compactBR = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${numberBR.format(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${numberBR.format(Math.round(hours))} h`;
  return `${numberBR.format(Math.round(hours / 24))} dias`;
}

export function formatDurationDetail(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return `${numberBR.format(minutes)} min · ${numberBR.format(hours)} h${days ? ` · ${numberBR.format(days)} dias` : ''}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function dateBR(value: string | null): string {
  if (!value) return '—';
  return format(parseISO(value.slice(0, 10)), "d 'de' MMM", { locale: ptBR });
}

export function capsulePeriod(filters: Filters): string {
  const start = parseISO(filters.startDate);
  const end = parseISO(filters.endDate);
  if (filters.startDate.slice(0, 7) === filters.endDate.slice(0, 7)) {
    return format(start, 'MMMM yyyy', { locale: ptBR }).replace(/^./, (c: string) => c.toUpperCase());
  }
  if (filters.startDate.slice(0, 4) === filters.endDate.slice(0, 4)) return filters.startDate.slice(0, 4);
  return `${filters.startDate.slice(0, 4)}–${filters.endDate.slice(0, 4)}`;
}

export function safeFileName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}
