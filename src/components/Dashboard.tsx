import { useState } from 'react';
import { CalendarCheck, Clock3, Headphones, Music, Radio, UsersRound } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useDashboardData } from '../hooks/useDashboardData';
import type { BumpGranularity, Granularity, HeatmapMode, TopKind, TopLimit } from '../types';
import { compactBR, dateBR, formatDuration, formatDurationDetail, numberBR } from '../lib/format';
import { Header, type DashboardView } from './dashboard/Header';
import { GlobalFilters } from './filters/GlobalFilters';
import { KpiCard } from './dashboard/KpiCard';
import { ComparisonNote } from './dashboard/ComparisonNote';
import { SectionHeader } from './dashboard/SectionHeader';
import { TopList } from './dashboard/TopList';
import { LoadingState, ErrorState, EmptyState } from './loading/States';
import { EvolutionChart } from './charts/EvolutionChart';
import { BumpChart } from './charts/BumpChart';
import { HourlyHeatmap } from './charts/HourlyHeatmap';
import { DayPeriodChart } from './charts/DayPeriodChart';
import { DiscoveryChart } from './charts/DiscoveryChart';
import { DiscoverySignatureChart } from './charts/DiscoverySignatureChart';
import { ArtistMap } from './charts/ArtistMap';
import { ListeningFlow } from './charts/ListeningFlow';
import { LastFmPage } from './lastfm/LastFmPage';
import { CapsuleModal } from './capsule/CapsuleModal';

const topLabels: Record<TopKind, string> = { artists: 'Artistas', tracks: 'Músicas', albums: 'Álbuns' };
const heatLabels: Record<HeatmapMode, string> = { day: 'Dia', week: 'Semana', month: 'Mês', weekend: 'Fim de semana' };
const REPO_URL = 'https://github.com/gabrriela07/capsula_sonora_caseira';

export function Dashboard() {
  const { profile, filters, reset } = useAppStore();
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [view, setView] = useState<DashboardView>('dashboard');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [bumpGranularity, setBumpGranularity] = useState<BumpGranularity>('month');
  const [heatMode, setHeatMode] = useState<HeatmapMode>('week');
  const [topKind, setTopKind] = useState<TopKind>('artists');
  const [topLimit, setTopLimit] = useState<TopLimit>(10);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const { data, loading, error, retry } = useDashboardData(debouncedFilters, granularity, bumpGranularity, heatMode);
  if (!profile) return null;
  const topItems = data ? ({ artists: data.topArtists, tracks: data.topTracks, albums: data.topAlbums }[topKind]).slice(0, topLimit) : [];
  const metricLabel = profile.hasDuration ? 'horas ouvidas' : 'reproduções';

  return <div className="min-h-screen bg-carbon">
    <Header
      profile={profile}
      onCapsule={() => data && setCapsuleOpen(true)}
      onReset={reset}
      capsuleDisabled={!data || loading || filters !== debouncedFilters}
      activeView={view}
      onViewChange={setView}
    />
    <main className="mx-auto max-w-[1600px] space-y-8 px-4 py-6 md:px-8 md:py-8">
      <GlobalFilters />
      {!profile.hasDuration && <div className="rounded-2xl border border-banana/20 bg-banana/5 px-4 py-3 text-sm text-banana">O arquivo não tem duração mapeada. Rankings, gráficos e comparações usam contagem de reproduções; KPIs de tempo ficam indisponíveis.</div>}
      {error ? <ErrorState message={error} onRetry={() => void retry()} /> : !data ? <LoadingState /> : data.kpis.plays === 0 ? <EmptyState /> : <>
        {view === 'lastfm' ? <LastFmPage data={data} filters={debouncedFilters} hasDuration={profile.hasDuration} /> : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm text-zinc-500">Visão geral</p><h2 className="text-2xl font-extrabold tracking-tight">Seu período em números</h2></div>
            <div className="flex items-center gap-3">{loading && data && <span className="animate-pulse text-xs text-slime">Atualizando…</span>}<ComparisonNote /></div>
          </div>
          <section className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-6 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <KpiCard label="Tempo ouvido" value={profile.hasDuration ? formatDuration(data.kpis.totalMs) : '—'} detail={profile.hasDuration ? formatDurationDetail(data.kpis.totalMs) : 'sem duração no arquivo'} current={data.kpis.totalMs} previous={data.kpis.previous.totalMs} icon={Headphones} />
            <KpiCard label="Reproduções" value={numberBR.format(data.kpis.plays)} detail="linhas após filtros" current={data.kpis.plays} previous={data.kpis.previous.plays} icon={Radio} accent="pink" />
            <KpiCard label="Artistas únicos" value={numberBR.format(data.kpis.artists)} detail="no período" current={data.kpis.artists} previous={data.kpis.previous.artists} icon={UsersRound} accent="yellow" />
            <KpiCard label="Músicas únicas" value={numberBR.format(data.kpis.tracks)} detail="artista + faixa" current={data.kpis.tracks} previous={data.kpis.previous.tracks} icon={Music} />
            <KpiCard label="Dia com mais escuta" value={dateBR(data.kpis.bestDay)} detail={profile.hasDuration ? formatDuration(data.kpis.bestDayMs) : 'por nº de plays'} current={data.kpis.bestDayMs} previous={data.kpis.previous.bestDayMs} icon={CalendarCheck} accent="pink" />
            <KpiCard label="Maior sequência" value={`${data.kpis.longestStreak} dias`} detail="dias seguidos ouvindo" current={data.kpis.longestStreak} previous={data.kpis.previous.longestStreak} icon={Clock3} accent="yellow" />
          </section>
          <section className="panel overflow-visible">
            <SectionHeader
              title="Seus favoritos"
              description={`Ranking por ${metricLabel}. Passe o cursor para ver detalhes.`}
              action={<div className="flex flex-wrap gap-2">
                <div className="flex rounded-full bg-carbon p-1">{(Object.keys(topLabels) as TopKind[]).map((kind) => <button key={kind} onClick={() => setTopKind(kind)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${topKind === kind ? 'bg-slime text-carbon' : 'text-zinc-400 hover:text-white'}`}>{topLabels[kind]}</button>)}</div>
                <select className="h-9 rounded-full border border-white/10 bg-carbon px-3 text-xs font-semibold outline-none" value={topLimit} onChange={(event) => setTopLimit(Number(event.target.value) as TopLimit)}><option value={5}>Top 5</option><option value={10}>Top 10</option><option value={20}>Top 20</option></select>
              </div>}
            />
            {topItems.length
              ? <TopList items={topItems} hasDuration={profile.hasDuration} kind={topKind} />
              : <p className="py-12 text-center text-sm text-zinc-500">Nenhum item disponível.</p>}
          </section>
          <section className="grid gap-6 xl:grid-cols-2">
            <article className="panel overflow-visible">
              <SectionHeader title="Evolução do tempo" description={`Total de ${metricLabel} por período. Todos os rótulos são mantidos.`} action={<select className="h-9 rounded-full border border-white/10 bg-carbon px-3 text-xs font-semibold outline-none" value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="year">Ano</option></select>} />
              <EvolutionChart data={data.evolution} hasDuration={profile.hasDuration} />
            </article>
            <article className="panel">
              <SectionHeader title="Ranking em movimento" description="Posição dos cinco artistas líderes em cada período." action={<select className="h-9 rounded-full border border-white/10 bg-carbon px-3 text-xs font-semibold outline-none" value={bumpGranularity} onChange={(event) => setBumpGranularity(event.target.value as BumpGranularity)}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></select>} />
              <BumpChart data={data.bump} granularity={bumpGranularity} />
            </article>
            <article className="panel overflow-visible xl:col-span-2"><SectionHeader title="Acumulado da jornada" description={`Crescimento de ${metricLabel} ao longo de todo o recorte.`} /><EvolutionChart data={data.cumulative} hasDuration={profile.hasDuration} cumulative /></article>
          </section>
          <section>
            <SectionHeader title="Seus ritmos" description="Quando sua escuta acontece." />
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <article className="panel overflow-visible">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Dia da semana × hora</h3><div className="flex rounded-full bg-carbon p-1">{(['day', 'week', 'month', 'weekend'] as HeatmapMode[]).map((mode) => <button key={mode} onClick={() => setHeatMode(mode)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${heatMode === mode ? 'bg-slime text-carbon' : 'text-zinc-400 hover:text-white'}`}>{heatLabels[mode]}</button>)}</div></div>
                <HourlyHeatmap data={data.heatmap} hasDuration={profile.hasDuration} mode={heatMode} />
              </article>
              <article className="panel"><h3 className="mb-2 font-bold">Períodos do dia</h3><DayPeriodChart data={data.dayPeriods} hasDuration={profile.hasDuration} /></article>
            </div>
          </section>
          <section>
            <SectionHeader title="Galáxia da sua escuta" description="Todos os artistas líderes conectados em uma órbita dinâmica, sem depender de localização externa." />
            <ArtistMap artists={data.topArtists} hasDuration={profile.hasDuration} />
          </section>
          <section>
            <SectionHeader title="Descoberta e fidelidade" description="Quem chegou agora e quem atravessou os anos com você." />
            <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
              <article className="panel"><h3 className="mb-1 font-bold">Novos artistas</h3><p className="mb-4 text-xs text-zinc-500">Primeira aparição no histórico e uma assinatura multiindicador do seu comportamento.</p><div className="grid gap-5 lg:grid-cols-2"><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-banana">estreias por período</p><DiscoveryChart data={data.discovery} /></div><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-petal">assinatura de descoberta</p><DiscoverySignatureChart data={data} /></div></div></article>
              <article className="panel"><h3 className="mb-1 font-bold">Artistas mais fiéis</h3><p className="mb-5 text-xs text-zinc-500">Ordenados por quantidade de anos distintos.</p><ol className="space-y-3">{data.loyal.map((artist, index) => <li key={artist.artist} className="flex items-center gap-3 rounded-xl bg-carbon/45 px-3 py-2.5 transition hover:bg-carbon/70"><span className="w-6 text-sm font-extrabold text-petal">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{artist.artist}</span><span className="rounded-full bg-banana/10 px-2.5 py-1 text-xs font-bold text-banana">{artist.years} {artist.years === 1 ? 'ano' : 'anos'}</span><span className="hidden text-xs text-zinc-500 sm:block">{artist.firstYear}–{artist.lastYear}</span></li>)}</ol></article>
            </div>
          </section>
          <section>
            <SectionHeader title="Fluxo da sua escuta" description="Artistas que aparecem em sequência nas suas sessões — uma timeline interativa das conexões mais recorrentes." />
            <ListeningFlow transitions={data.transitions} artists={data.topArtists} />
          </section>
        </>}
        <footer className="flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between"><p>Feito com ❤️ por <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-slime underline-offset-4 transition hover:text-white hover:underline" title="Ver o projeto no GitHub">/gabrriela07</a></p><p>{compactBR.format(Math.max(0, profile.rowCount - profile.validRows - profile.duplicateRows))} linhas inválidas removidas · {compactBR.format(profile.duplicateRows)} duplicatas exatas removidas</p></footer>
        <CapsuleModal open={capsuleOpen} onClose={() => setCapsuleOpen(false)} data={data} filters={debouncedFilters} hasDuration={profile.hasDuration} />
      </>}
    </main>
  </div>;
}
