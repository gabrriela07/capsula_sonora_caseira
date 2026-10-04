import { useEffect, useState } from 'react';
import { endOfMonth, endOfYear, format, parseISO, startOfMonth, startOfYear, subDays, subMonths, subYears } from 'date-fns';
import { CalendarDays, Filter, RotateCcw } from 'lucide-react';
import { analytics } from '../../lib/duckdb';
import { useAppStore } from '../../store/useAppStore';
import type { FilterOption } from '../../types';

export function GlobalFilters() {
  const { filters, profile, setFilters } = useAppStore();
  const [artists, setArtists] = useState<FilterOption[]>([]);
  const [albums, setAlbums] = useState<FilterOption[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  useEffect(() => { void analytics.filterOptions().then((options) => { setArtists(options.artists); setAlbums(options.albums); setMonths(options.months); }); }, [profile]);
  if (!profile) return null;
  const anchor = parseISO(profile.maxDate);

  const presets = [
    { label: 'Último mês', start: format(subDays(anchor, 29), 'yyyy-MM-dd'), end: profile.maxDate },
    { label: 'Últimos 3 meses', start: format(subMonths(anchor, 3), 'yyyy-MM-dd'), end: profile.maxDate },
    { label: 'Este ano', start: format(startOfYear(anchor), 'yyyy-MM-dd'), end: format(endOfYear(anchor) > anchor ? anchor : endOfYear(anchor), 'yyyy-MM-dd') },
    { label: 'Ano passado', start: format(startOfYear(subYears(anchor, 1)), 'yyyy-MM-dd'), end: format(endOfYear(subYears(anchor, 1)), 'yyyy-MM-dd') },
    { label: 'Todo o período', start: profile.minDate, end: profile.maxDate },
  ];

  function applyPreset(start: string, end: string) { setFilters({ startDate: start, endDate: end, yearMonth: '' }); }
  function applyMonth(month: string) {
    if (!month) return setFilters({ yearMonth: '' });
    const date = parseISO(`${month}-01`);
    setFilters({ yearMonth: month, startDate: format(startOfMonth(date), 'yyyy-MM-dd'), endDate: format(endOfMonth(date), 'yyyy-MM-dd') });
  }

  return <section className="panel">
    <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slime" /><h2 className="font-bold">Filtros globais</h2></div><button className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white" onClick={() => setFilters({ startDate: profile.minDate, endDate: profile.maxDate, artist: '', album: '', yearMonth: '', minSeconds: 30 })}><RotateCcw className="h-3.5 w-3.5" /> Limpar</button></div>
    <div className="mb-5 flex flex-wrap gap-2">{presets.map((preset) => { const active = filters.startDate === preset.start && filters.endDate === preset.end && !filters.yearMonth; return <button key={preset.label} onClick={() => applyPreset(preset.start, preset.end)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-slime text-carbon' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}>{preset.label}</button>; })}</div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <label><span className="label">De</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" /><input type="date" min={profile.minDate} max={filters.endDate || profile.maxDate} value={filters.startDate} onChange={(event) => setFilters({ startDate: event.target.value, yearMonth: '' })} className="field pl-9" /></div></label>
      <label><span className="label">Até</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" /><input type="date" min={filters.startDate || profile.minDate} max={profile.maxDate} value={filters.endDate} onChange={(event) => setFilters({ endDate: event.target.value, yearMonth: '' })} className="field pl-9" /></div></label>
      <label><span className="label">Ano / mês</span><select className="field" value={filters.yearMonth} onChange={(event) => applyMonth(event.target.value)}><option value="">Todos</option>{months.map((month) => <option key={month} value={month}>{month.split('-').reverse().join('/')}</option>)}</select></label>
      <label><span className="label">Artista</span><input className="field" list="artist-options" value={filters.artist} placeholder="Todos os artistas" onChange={(event) => setFilters({ artist: event.target.value })} /><datalist id="artist-options">{artists.map((option) => <option key={option.value} value={option.value} />)}</datalist></label>
      <label><span className="label">Álbum</span><input className="field" list="album-options" value={filters.album} placeholder="Todos os álbuns" onChange={(event) => setFilters({ album: event.target.value })} /><datalist id="album-options">{albums.map((option) => <option key={option.value} value={option.value} />)}</datalist></label>
      <label><span className="label">Mínimo por play</span><select className="field" value={filters.minSeconds} disabled={!profile.hasDuration} onChange={(event) => setFilters({ minSeconds: Number(event.target.value) })}><option value={0}>Sem mínimo</option><option value={15}>15 segundos</option><option value={30}>30 segundos</option><option value={60}>1 minuto</option><option value={120}>2 minutos</option></select></label>
    </div>
    <p className="mt-4 text-xs text-zinc-500">Atalhos relativos usam a data mais recente do arquivo ({profile.maxDate.split('-').reverse().join('/')}). {profile.hasDuration ? `Reproduções abaixo de ${filters.minSeconds}s são ignoradas.` : 'Sem coluna de duração: cada linha válida conta como 1 reprodução.'}</p>
  </section>;
}
