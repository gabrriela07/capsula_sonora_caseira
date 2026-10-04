import { useState } from 'react';
import { CalendarCheck, Clock3, Headphones, Music, Radio, UsersRound } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useDashboardData } from '../hooks/useDashboardData';
import type { Granularity, TopKind, TopLimit } from '../types';
import { compactBR, dateBR, formatDuration, formatDurationDetail, numberBR } from '../lib/format';
import { Header } from './dashboard/Header';
import { GlobalFilters } from './filters/GlobalFilters';
import { KpiCard } from './dashboard/KpiCard';
import { ComparisonNote } from './dashboard/ComparisonNote';
import { SectionHeader } from './dashboard/SectionHeader';
import { TopList } from './dashboard/TopList';
import { LoadingState, ErrorState, EmptyState } from './loading/States';
import { EvolutionChart } from './charts/EvolutionChart';
import { BumpChart } from './charts/BumpChart';
import { HourlyHeatmap } from './charts/HourlyHeatmap';
import { CalendarHeatmap } from './charts/CalendarHeatmap';
import { DayPeriodChart } from './charts/DayPeriodChart';
import { DiscoveryChart } from './charts/DiscoveryChart';
import { CapsuleModal } from './capsule/CapsuleModal';

const topLabels: Record<TopKind, string> = { artists: 'Artistas', tracks: 'Músicas', albums: 'Álbuns' };

export function Dashboard() {
  const { profile, filters, reset } = useAppStore();
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [topKind, setTopKind] = useState<TopKind>('artists');
  const [topLimit, setTopLimit] = useState<TopLimit>(10);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const { data, loading, error, retry } = useDashboardData(debouncedFilters, granularity);
  if (!profile) return null;

  const topItems = data ? ({ artists: data.topArtists, tracks: data.topTracks, albums: data.topAlbums }[topKind]).slice(0, topLimit) : [];
  const metricLabel = profile.hasDuration ? 'horas ouvidas' : 'reproduções';

  return <div className="min-h-screen bg-carbon">
    <Header profile={profile} onCapsule={() => data && setCapsuleOpen(true)} onReset={reset} capsuleDisabled={!data || loading || filters !== debouncedFilters} />
    <main className="mx-auto max-w-[1600px] space-y-8 px-4 py-6 md:px-8 md:py-8">
      <GlobalFilters />
      {!profile.hasDuration && <div className="rounded-2xl border border-banana/20 bg-banana/5 px-4 py-3 text-sm text-banana">O arquivo não tem duração mapeada. Rankings, gráficos e comparações usam contagem de reproduções; KPIs de tempo ficam indisponíveis.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-zinc-500">Visão geral</p><h2 className="text-2xl font-extrabold tracking-tight">Seu período em números</h2></div><div className="flex items-center gap-3">{loading && data && <span className="animate-pulse text-xs text-slime">Atualizando…</span>}<ComparisonNote /></div></div>

      {error ? <ErrorState message={error} onRetry={() => void retry()} /> : !data ? <LoadingState /> : data.kpis.plays === 0 ? <EmptyState /> : <>
        <section className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-6 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <KpiCard label="Tempo ouvido" value={profile.hasDuration ? formatDuration(data.kpis.totalMs) : '—'} detail={profile.hasDuration ? formatDurationDetail(data.kpis.totalMs) : 'sem duração no arquivo'} current={data.kpis.totalMs} previous={data.kpis.previous.totalMs} icon={Headphones} />
          <KpiCard label="Reproduções" value={numberBR.format(data.kpis.plays)} detail="linhas após filtros" current={data.kpis.plays} previous={data.kpis.previous.plays} icon={Radio} accent="pink" />
          <KpiCard label="Artistas únicos" value={numberBR.format(data.kpis.artists)} detail="no período" current={data.kpis.artists} previous={data.kpis.previous.artists} icon={UsersRound} accent="yellow" />
          <KpiCard label="Músicas únicas" value={numberBR.format(data.kpis.tracks)} detail="artista + faixa" current={data.kpis.tracks} previous={data.kpis.previous.tracks} icon={Music} />
          <KpiCard label="Dia com mais escuta" value={dateBR(data.kpis.bestDay)} detail={profile.hasDuration ? formatDuration(data.kpis.bestDayMs) : 'por nº de plays'} current={data.kpis.bestDayMs} previous={data.kpis.previous.bestDayMs} icon={CalendarCheck} accent="pink" />
          <KpiCard label="Maior sequência" value={`${data.kpis.longestStreak} dias`} detail="dias seguidos ouvindo" current={data.kpis.longestStreak} previous={data.kpis.previous.longestStreak} icon={Clock3} accent="yellow" />
        </section>

        <section className="panel">
          <SectionHeader title="Seus favoritos" description={`Ranking por ${metricLabel}.`} action={<div className="flex flex-wrap gap-2"><div className="flex rounded-full bg-carbon p-1">{(Object.keys(topLabels) as TopKind[]).map((kind) => <button key={kind} onClick={() => setTopKind(kind)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${topKind === kind ? 'bg-slime text-carbon' : 'text-zinc-400 hover:text-white'}`}>{topLabels[kind]}</button>)}</div><select className="h-9 rounded-full border border-white/10 bg-carbon px-3 text-xs font-semibold outline-none" value={topLimit} onChange={(event) => setTopLimit(Number(event.target.value) as TopLimit)}><option value={5}>Top 5</option><option value={10}>Top 10</option><option value={20}>Top 20</option></select></div>} />
          {topItems.length ? <TopList items={topItems} hasDuration={profile.hasDuration} /> : <p className="py-12 text-center text-sm text-zinc-500">Nenhum item disponível.</p>}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="panel"><SectionHeader title="Evolução do tempo" description={`Total de ${metricLabel} por período.`} action={<select className="h-9 rounded-full border border-white/10 bg-carbon px-3 text-xs font-semibold outline-none" value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="year">Ano</option></select>} /><EvolutionChart data={data.evolution} hasDuration={profile.hasDuration} /></article>
          <article className="panel"><SectionHeader title="Ranking em movimento" description="Posição dos cinco artistas líderes em cada período." /><BumpChart data={data.bump} /></article>
          <article className="panel xl:col-span-2"><SectionHeader title="Acumulado da jornada" description={`Crescimento de ${metricLabel} ao longo de todo o recorte.`} /><EvolutionChart data={data.cumulative} hasDuration={profile.hasDuration} cumulative /></article>
        </section>

        <section>
          <SectionHeader title="Seus ritmos" description="Quando sua escuta acontece." />
          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><article className="panel"><h3 className="mb-5 font-bold">Dia da semana × hora</h3><HourlyHeatmap data={data.heatmap} hasDuration={profile.hasDuration} /></article><article className="panel"><h3 className="mb-2 font-bold">Períodos do dia</h3><DayPeriodChart data={data.dayPeriods} hasDuration={profile.hasDuration} /></article><article className="panel xl:col-span-2"><h3 className="mb-1 font-bold">Calendário de escuta</h3><p className="mb-5 text-xs text-zinc-500">Role horizontalmente para atravessar os anos.</p><CalendarHeatmap data={data.calendar} hasDuration={profile.hasDuration} /></article></div>
        </section>

        <section>
          <SectionHeader title="Descoberta e fidelidade" description="Quem chegou agora e quem atravessou os anos com você." />
          <div className="grid gap-6 xl:grid-cols-2"><article className="panel"><h3 className="mb-1 font-bold">Novos artistas</h3><p className="mb-4 text-xs text-zinc-500">Primeira aparição no histórico, dentro do período.</p><DiscoveryChart data={data.discovery} /></article><article className="panel"><h3 className="mb-1 font-bold">Artistas mais fiéis</h3><p className="mb-5 text-xs text-zinc-500">Ordenados por quantidade de anos distintos.</p><ol className="space-y-3">{data.loyal.map((artist, index) => <li key={artist.artist} className="flex items-center gap-3 rounded-xl bg-carbon/45 px-3 py-2.5"><span className="w-6 text-sm font-extrabold text-petal">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{artist.artist}</span><span className="rounded-full bg-banana/10 px-2.5 py-1 text-xs font-bold text-banana">{artist.years} {artist.years === 1 ? 'ano' : 'anos'}</span><span className="hidden text-xs text-zinc-500 sm:block">{artist.firstYear}–{artist.lastYear}</span></li>)}</ol></article></div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between"><p>Feito com ❤️ por /gabrriela07</p><p>{compactBR.format(Math.max(0, profile.rowCount - profile.validRows - profile.duplicateRows))} linhas inválidas removidas · {compactBR.format(profile.duplicateRows)} duplicatas exatas removidas</p></footer>
        <CapsuleModal open={capsuleOpen} onClose={() => setCapsuleOpen(false)} data={data} filters={debouncedFilters} hasDuration={profile.hasDuration} />
      </>}
    </main>
  </div>;
}
