export type FieldKey = 'timestamp' | 'artist' | 'track' | 'album' | 'duration';

export type ColumnMapping = Record<FieldKey, string>;

export interface SchemaColumn {
  name: string;
  type: string;
}

export interface DataProfile {
  fileName: string;
  rowCount: number;
  validRows: number;
  duplicateRows: number;
  minDate: string;
  maxDate: string;
  hasDuration: boolean;
  columns: SchemaColumn[];
}

export interface Filters {
  startDate: string;
  endDate: string;
  artist: string;
  album: string;
  yearMonth: string;
  minSeconds: number;
}

export interface Kpis {
  totalMs: number;
  plays: number;
  artists: number;
  tracks: number;
  bestDay: string | null;
  bestDayMs: number;
  longestStreak: number;
}

export interface ComparisonKpis extends Kpis {
  previous: Kpis;
}

export interface RankedItem {
  name: string;
  artist?: string;
  value: number;
  plays: number;
  imageUrl?: string;
  lastFmUrl?: string;
  mbid?: string;
}

export interface TimePoint {
  period: string;
  value: number;
  cumulative?: number;
}

export interface BumpPoint {
  period: string;
  artist: string;
  rank: number;
  value: number;
}

export interface HeatCell {
  weekday: number;
  hour: number;
  value: number;
}

export interface CalendarCell {
  day: string;
  value: number;
  plays: number;
}

export interface DayPeriod {
  name: string;
  value: number;
}

export interface DiscoveryPoint {
  period: string;
  count: number;
}

export interface LoyalArtist {
  artist: string;
  years: number;
  firstYear: number;
  lastYear: number;
}

export interface FilterOption {
  value: string;
  count: number;
}

export type Granularity = 'day' | 'week' | 'month' | 'year';
export type TopKind = 'artists' | 'tracks' | 'albums';
export type TopLimit = 5 | 10 | 20;

export interface DashboardData {
  kpis: ComparisonKpis;
  topArtists: RankedItem[];
  topTracks: RankedItem[];
  topAlbums: RankedItem[];
  evolution: TimePoint[];
  bump: BumpPoint[];
  cumulative: TimePoint[];
  heatmap: HeatCell[];
  calendar: CalendarCell[];
  dayPeriods: DayPeriod[];
  discovery: DiscoveryPoint[];
  loyal: LoyalArtist[];
}
