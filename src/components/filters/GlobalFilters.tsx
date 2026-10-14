import { useEffect, useMemo, useState } from 'react';
import {
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { analytics } from '../../lib/duckdb';
import { useAppStore } from '../../store/useAppStore';
import type { FilterOption } from '../../types';

const brDate = (iso: string) => iso.split('-').reverse().join('/');
const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

export function GlobalFilters() {
  const { filters, profile, setFilters } = useAppStore();
  const [artists, setArtists] = useState<FilterOption[]>([]);
  const [albums, setAlbums] = useState<FilterOption[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() => new Date().getFullYear());
  const availableMonths = useMemo(() => new Set(months), [months]);

  useEffect(() => {
    let cancelled = false;
    void analytics.filterOptions({ artist: filters.artist, album: filters.album }).then((options) => {
      if (cancelled) return;
      setArtists(options.artists);
      setAlbums(options.albums);
      setMonths(options.months);
    });
    return () => { cancelled = true; };
  }, [profile, filters.artist, filters.album]);

  useEffect(() => {
    if (profile) setVisibleYear(parseISO(profile.maxDate).getFullYear());
  }, [profile]);

  if (!profile) return null;

  const anchor = parseISO(profile.maxDate);
  const selectedMonths = filters.yearMonth.split(',').filter(Boolean).sort();
  const availableYears = months.map((month) => Number(month.slice(0, 4))).filter(Number.isFinite);
  const minYear = availableYears.length ? Math.min(...availableYears) : parseISO(profile.minDate).getFullYear();
  const maxYear = availableYears.length ? Math.max(...availableYears) : parseISO(profile.maxDate).getFullYear();

  const presets = [
    { label: 'Último mês', start: format(subDays(anchor, 29), 'yyyy-MM-dd'), end: profile.maxDate },
    { label: 'Últimos 3 meses', start: format(subMonths(anchor, 3), 'yyyy-MM-dd'), end: profile.maxDate },
    { label: 'Este ano', start: format(startOfYear(anchor), 'yyyy-MM-dd'), end: format(endOfYear(anchor) > anchor ? anchor : endOfYear(anchor), 'yyyy-MM-dd') },
    { label: 'Ano passado', start: format(startOfYear(subYears(anchor, 1)), 'yyyy-MM-dd'), end: format(endOfYear(subYears(anchor, 1)), 'yyyy-MM-dd') },
    { label: 'Todo o período', start: profile.minDate, end: profile.maxDate },
  ];

  function applyPreset(start: string, end: string) {
    setFilters({ startDate: start, endDate: end, yearMonth: '' });
    setMonthPickerOpen(false);
  }

  function toggleMonth(value: string) {
    const next = selectedMonths.includes(value)
      ? selectedMonths.filter((month) => month !== value)
      : [...selectedMonths, value].sort();

    if (!next.length) {
      setFilters({ yearMonth: '' });
      return;
    }

    const first = parseISO(`${next[0]}-01`);
    const last = parseISO(`${next[next.length - 1]}-01`);
    const start = format(startOfMonth(first), 'yyyy-MM-dd');
    const calculatedEnd = format(endOfMonth(last), 'yyyy-MM-dd');
    const end = calculatedEnd > profile.maxDate ? profile.maxDate : calculatedEnd;
    setFilters({ yearMonth: next.join(','), startDate: start, endDate: end });
  }

  const summary = [
    `${brDate(filters.startDate)} – ${brDate(filters.endDate)}`,
    selectedMonths.length > 0 && `${selectedMonths.length} ${selectedMonths.length === 1 ? 'mês selecionado' : 'meses selecionados'}`,
    filters.artist && `Artista: ${filters.artist}`,
    filters.album && `Álbum: ${filters.album}`,
  ].filter(Boolean) as string[];

  const periodLabel = selectedMonths.length
    ? selectedMonths.map((month) => format(parseISO(`${month}-01`), "MMM/yy", { locale: ptBR })).join(' · ')
    : 'Escolher meses';

  return <section className="panel relative z-20 overflow-visible">
    <div className={`flex flex-wrap items-center justify-between gap-3 ${collapsed ? '' : 'mb-5'}`}>
      <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed}>
        <Filter className="h-4 w-4 shrink-0 text-slime" />
        <h2 className="font-bold">Filtros globais</h2>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`} />
      </button>
      {collapsed && <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {summary.map((item) => <span key={item} className="max-w-full truncate rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">{item}</span>)}
      </div>}
      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white"
          onClick={() => setFilters({ startDate: profile.minDate, endDate: profile.maxDate, artist: '', album: '', yearMonth: '' })}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Limpar
        </button>
        <button type="button" className="text-xs font-semibold text-slime transition hover:text-white" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? 'Expandir' : 'Recolher'}
        </button>
      </div>
    </div>

    {!collapsed && <>
      <div className="mb-5 flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = filters.startDate === preset.start && filters.endDate === preset.end && !filters.yearMonth;
          return <button key={preset.label} onClick={() => applyPreset(preset.start, preset.end)} className={`filter-chip ${active ? 'filter-chip-active' : ''}`}>
            {preset.label}
          </button>;
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]">
        <div className="relative">
          <span className="label">Período</span>
          <button
            type="button"
            className={`field flex items-center gap-3 text-left ${monthPickerOpen ? 'border-slime/70 ring-2 ring-slime/15' : ''}`}
            onClick={() => setMonthPickerOpen((value) => !value)}
            aria-expanded={monthPickerOpen}
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-slime" />
            <span className="min-w-0 flex-1 truncate">{periodLabel}</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-400">multi</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition ${monthPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {monthPickerOpen && <div className="absolute left-0 top-[72px] z-50 w-full min-w-[310px] rounded-3xl border border-white/10 bg-[#242426]/98 p-4 shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-xl sm:w-[430px]">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" className="calendar-nav" disabled={visibleYear <= minYear} onClick={() => setVisibleYear((year) => year - 1)} aria-label="Ano anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-sm font-extrabold text-white">{visibleYear}</p>
                <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">selecione um ou mais meses</p>
              </div>
              <button type="button" className="calendar-nav" disabled={visibleYear >= maxYear} onClick={() => setVisibleYear((year) => year + 1)} aria-label="Próximo ano">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 12 }, (_, month) => {
                const key = monthKey(visibleYear, month);
                const selected = selectedMonths.includes(key);
                const available = availableMonths.has(key);
                return <button
                  key={key}
                  type="button"
                  disabled={!available}
                  onClick={() => toggleMonth(key)}
                  className={`month-tile ${selected ? 'month-tile-active' : ''}`}
                >
                  <span>{format(new Date(visibleYear, month, 1), 'MMM', { locale: ptBR })}</span>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </button>;
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <button type="button" className="text-xs font-semibold text-zinc-400 transition hover:text-white" onClick={() => setFilters({ yearMonth: '' })}>Limpar meses</button>
              <button type="button" className="rounded-full bg-slime px-4 py-2 text-xs font-extrabold text-carbon" onClick={() => setMonthPickerOpen(false)}>Aplicar</button>
            </div>
          </div>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="sr-only">Data inicial</span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                <input type="date" min={profile.minDate} max={filters.endDate || profile.maxDate} value={filters.startDate} onChange={(event) => setFilters({ startDate: event.target.value, yearMonth: '' })} className="field pl-9" />
              </div>
            </label>
            <label>
              <span className="sr-only">Data final</span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                <input type="date" min={filters.startDate || profile.minDate} max={profile.maxDate} value={filters.endDate} onChange={(event) => setFilters({ endDate: event.target.value, yearMonth: '' })} className="field pl-9" />
              </div>
            </label>
          </div>
        </div>

        <label>
          <span className="label">Artista</span>
          <select className="field" value={filters.artist} onChange={(event) => setFilters({ artist: event.target.value })}>
            <option value="">Todos os artistas</option>
            {artists.map((option) => <option key={option.value} value={option.value}>{option.value} · {option.count.toLocaleString('pt-BR')}</option>)}
          </select>
          <span className="mt-2 block text-[11px] text-zinc-500">A lista respeita o álbum selecionado.</span>
        </label>

        <label>
          <span className="label">Álbum</span>
          <select className="field" value={filters.album} onChange={(event) => setFilters({ album: event.target.value })}>
            <option value="">Todos os álbuns</option>
            {albums.map((option) => <option key={option.value} value={option.value}>{option.value} · {option.count.toLocaleString('pt-BR')}</option>)}
          </select>
          <span className="mt-2 block text-[11px] text-zinc-500">A lista respeita o artista selecionado.</span>
        </label>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Data atual: ({brDate(profile.maxDate)})
      </p>
    </>}
  </section>;
}
