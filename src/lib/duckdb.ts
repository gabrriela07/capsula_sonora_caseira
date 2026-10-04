import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbMvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdbMvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdbEhWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdbEhWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import type {
  BumpPoint,
  CalendarCell,
  ColumnMapping,
  DashboardData,
  DataProfile,
  DayPeriod,
  DiscoveryPoint,
  FilterOption,
  Filters,
  Granularity,
  HeatCell,
  Kpis,
  LoyalArtist,
  RankedItem,
  SchemaColumn,
  TimePoint,
} from '../types';
import { quoteIdentifier, quoteLiteral, toDateString } from './sql';

const LOCAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdbMvpWasm,
    mainWorker: duckdbMvpWorker,
  },
  eh: {
    mainModule: duckdbEhWasm,
    mainWorker: duckdbEhWorker,
  },
};

type Row = Record<string, unknown>;

function plainRows(table: { toArray(): Array<{ toJSON(): Row }> }): Row[] {
  return table.toArray().map((row) => {
    const source = row.toJSON();
    return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]));
  });
}

function asNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  return Number(value ?? 0);
}

class LocalAnalytics {
  private dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;
  private sourceSql = '';
  private fileName = '';
  private hasDuration = false;
  private sourceColumns = new Set<string>();

  private async db(): Promise<duckdb.AsyncDuckDB> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const bundle = await duckdb.selectBundle(LOCAL_BUNDLES);
        if (!bundle.mainWorker) throw new Error('Nenhum worker compatível do DuckDB foi encontrado.');
        const worker = new Worker(bundle.mainWorker);
        const logger = new duckdb.ConsoleLogger();
        const database = new duckdb.AsyncDuckDB(logger, worker);
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
        return database;
      })();
    }
    return this.dbPromise;
  }

  private async query(sql: string): Promise<Row[]> {
    const database = await this.db();
    const connection = await database.connect();
    try {
      return plainRows(await connection.query(sql));
    } finally {
      await connection.close();
    }
  }

  async inspectFile(file: File): Promise<SchemaColumn[]> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'parquet') {
      throw new Error('Formato não suportado. Selecione um arquivo .csv ou .parquet.');
    }
    const database = await this.db();
    this.fileName = `history_${Date.now()}.${extension}`;
    await database.registerFileHandle(this.fileName, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    this.sourceSql = extension === 'parquet'
      ? `read_parquet(${quoteLiteral(this.fileName)})`
      : `read_csv_auto(${quoteLiteral(this.fileName)}, header=true, sample_size=200000, all_varchar=true, ignore_errors=true)`;
    const rows = await this.query(`DESCRIBE SELECT * FROM ${this.sourceSql}`);
    this.sourceColumns = new Set(rows.map((row) => String(row.column_name).toLowerCase()));
    return rows.map((row) => ({ name: String(row.column_name), type: String(row.column_type) }));
  }

  async normalize(mapping: ColumnMapping, originalName: string): Promise<DataProfile> {
    if (!this.sourceSql) throw new Error('Carregue um arquivo antes de confirmar o mapeamento.');
    this.hasDuration = Boolean(mapping.duration);
    const timestamp = quoteIdentifier(mapping.timestamp);
    const playedAt = mapping.timestamp.toLowerCase().trim() === 'date_1'
      ? `TRY_STRPTIME(CAST(${timestamp} AS VARCHAR), '%d %b %Y %H:%M')`
      : `TRY_CAST(CAST(${timestamp} AS VARCHAR) AS TIMESTAMP)`;
    const artist = quoteIdentifier(mapping.artist);
    const track = quoteIdentifier(mapping.track);
    const album = mapping.album ? `COALESCE(NULLIF(TRIM(CAST(${quoteIdentifier(mapping.album)} AS VARCHAR)), ''), 'Sem álbum')` : `'Sem álbum'`;
    const duration = mapping.duration
      ? `GREATEST(COALESCE(TRY_CAST(${quoteIdentifier(mapping.duration)} AS BIGINT), 0), 0)`
      : '0::BIGINT';
    const optionalText = (name: string) => this.sourceColumns.has(name)
      ? `COALESCE(NULLIF(TRIM(CAST(${quoteIdentifier(name)} AS VARCHAR)), ''), '')`
      : `''`;
    const artistMbid = optionalText('artist_mbid');
    const albumMbid = optionalText('album_mbid');
    const trackMbid = optionalText('track_mbid');
    const imageUrl = optionalText('image_url');
    const lastFmUrl = optionalText('lastfm_url');
    const streamable = this.sourceColumns.has('streamable')
      ? `COALESCE(TRY_CAST(${quoteIdentifier('streamable')} AS BOOLEAN), false)`
      : 'false';

    await this.query(`CREATE OR REPLACE VIEW mapped_history AS
      SELECT
        ${playedAt} AS played_at,
        TRIM(CAST(${artist} AS VARCHAR)) AS artist,
        TRIM(CAST(${track} AS VARCHAR)) AS track,
        ${album} AS album,
        ${duration} AS duration_ms,
        ${artistMbid} AS artist_mbid,
        ${albumMbid} AS album_mbid,
        ${trackMbid} AS track_mbid,
        ${imageUrl} AS image_url,
        ${lastFmUrl} AS lastfm_url,
        ${streamable} AS streamable
      FROM ${this.sourceSql}`);
    await this.query('DROP TABLE IF EXISTS history');
    await this.query(`CREATE TABLE history AS
      SELECT DISTINCT played_at, artist, track, album, duration_ms,
        artist_mbid, album_mbid, track_mbid, image_url, lastfm_url, streamable
      FROM mapped_history
      WHERE played_at IS NOT NULL AND artist <> '' AND track <> ''`);

    const [stats] = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM mapped_history) AS row_count,
        (SELECT COUNT(*) FROM mapped_history WHERE played_at IS NOT NULL AND artist <> '' AND track <> '') AS mapped_valid,
        COUNT(*) AS valid_rows,
        CAST(MIN(CAST(played_at AS DATE)) AS VARCHAR) AS min_date,
        CAST(MAX(CAST(played_at AS DATE)) AS VARCHAR) AS max_date
      FROM history
    `);
    const rowCount = asNumber(stats.row_count);
    const validRows = asNumber(stats.valid_rows);
    const mappedValid = asNumber(stats.mapped_valid);
    if (!validRows) throw new Error('Nenhuma linha válida restou após o mapeamento. Verifique principalmente a coluna de data/hora.');

    const columns = await this.query(`DESCRIBE SELECT * FROM ${this.sourceSql}`);
    return {
      fileName: originalName,
      rowCount,
      validRows,
      duplicateRows: Math.max(0, mappedValid - validRows),
      minDate: toDateString(stats.min_date),
      maxDate: toDateString(stats.max_date),
      hasDuration: this.hasDuration,
      columns: columns.map((row) => ({ name: String(row.column_name), type: String(row.column_type) })),
    };
  }

  private where(filters: Filters, override?: { startDate: string; endDate: string }, includeDates = true): string {
    const conditions: string[] = [];
    const startDate = override?.startDate ?? filters.startDate;
    const endDate = override?.endDate ?? filters.endDate;
    if (includeDates && startDate) conditions.push(`played_at >= ${quoteLiteral(startDate)}::DATE`);
    if (includeDates && endDate) conditions.push(`played_at < (${quoteLiteral(endDate)}::DATE + INTERVAL 1 DAY)`);
    if (filters.artist) conditions.push(`artist = ${quoteLiteral(filters.artist)}`);
    if (filters.album) conditions.push(`album = ${quoteLiteral(filters.album)}`);
    if (filters.yearMonth && !override) conditions.push(`strftime(played_at, '%Y-%m') = ${quoteLiteral(filters.yearMonth)}`);
    if (this.hasDuration) conditions.push(`duration_ms >= ${Math.max(0, Math.round(filters.minSeconds * 1000))}`);
    return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  private metric(): string {
    return this.hasDuration ? 'duration_ms' : '1';
  }

  private async kpis(filters: Filters, override?: { startDate: string; endDate: string }): Promise<Kpis> {
    const rows = await this.query(`
      WITH filtered AS (
        SELECT * FROM history ${this.where(filters, override)}
      ), days AS (
        SELECT CAST(played_at AS DATE) AS day, SUM(duration_ms) AS ms, COUNT(*) AS plays,
               ${this.hasDuration ? 'SUM(duration_ms)' : 'COUNT(*)'} AS intensity
        FROM filtered GROUP BY 1
      ), numbered AS (
        SELECT day, ROW_NUMBER() OVER (ORDER BY day) AS rn FROM days
      ), streaks AS (
        SELECT COUNT(*) AS streak FROM numbered GROUP BY day - rn * INTERVAL 1 DAY
      )
      SELECT
        COALESCE((SELECT SUM(duration_ms) FROM filtered), 0) AS total_ms,
        (SELECT COUNT(*) FROM filtered) AS plays,
        (SELECT COUNT(DISTINCT artist) FROM filtered) AS artists,
        (SELECT COUNT(DISTINCT (artist, track)) FROM filtered) AS tracks,
        (SELECT CAST(day AS VARCHAR) FROM days ORDER BY intensity DESC, day ASC LIMIT 1) AS best_day,
        COALESCE((SELECT ms FROM days ORDER BY intensity DESC, day ASC LIMIT 1), 0) AS best_day_ms,
        COALESCE((SELECT MAX(streak) FROM streaks), 0) AS longest_streak
    `);
    const row = rows[0] ?? {};
    return {
      totalMs: asNumber(row.total_ms),
      plays: asNumber(row.plays),
      artists: asNumber(row.artists),
      tracks: asNumber(row.tracks),
      bestDay: row.best_day ? String(row.best_day).slice(0, 10) : null,
      bestDayMs: asNumber(row.best_day_ms),
      longestStreak: asNumber(row.longest_streak),
    };
  }

  private async top(filters: Filters, kind: 'artists' | 'tracks' | 'albums'): Promise<RankedItem[]> {
    const metric = this.metric();
    const select = kind === 'artists'
      ? `artist AS name, NULL AS artist, MAX(image_url) AS image_url, MAX(lastfm_url) AS lastfm_url, MAX(artist_mbid) AS mbid`
      : kind === 'tracks'
        ? `track AS name, artist, MAX(image_url) AS image_url, MAX(lastfm_url) AS lastfm_url, MAX(track_mbid) AS mbid`
        : `album AS name, NULL AS artist, MAX(image_url) AS image_url, MAX(lastfm_url) AS lastfm_url, MAX(album_mbid) AS mbid`;
    const group = kind === 'tracks' ? 'track, artist' : kind === 'artists' ? 'artist' : 'album';
    const extra = kind === 'albums' ? `${this.where(filters)} ${this.where(filters) ? 'AND' : 'WHERE'} album <> 'Sem álbum'` : this.where(filters);
    const rows = await this.query(`
      SELECT ${select}, SUM(${metric}) AS value, COUNT(*) AS plays
      FROM history ${extra}
      GROUP BY ${group}
      ORDER BY value DESC, name ASC
      LIMIT 20
    `);
    return rows.map((row) => ({
      name: String(row.name),
      artist: row.artist ? String(row.artist) : undefined,
      value: asNumber(row.value),
      plays: asNumber(row.plays),
      imageUrl: row.image_url ? String(row.image_url) : undefined,
      lastFmUrl: row.lastfm_url ? String(row.lastfm_url) : undefined,
      mbid: row.mbid ? String(row.mbid) : undefined,
    }));
  }

  private async evolution(filters: Filters, granularity: Granularity): Promise<TimePoint[]> {
    const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[granularity];
    const rows = await this.query(`
      SELECT CAST(DATE_TRUNC('${unit}', played_at) AS VARCHAR) AS period, SUM(${this.metric()}) AS value
      FROM history ${this.where(filters)}
      GROUP BY 1 ORDER BY 1
    `);
    return rows.map((row) => ({ period: String(row.period).slice(0, 10), value: asNumber(row.value) }));
  }

  private async bump(filters: Filters, granularity: Granularity): Promise<BumpPoint[]> {
    const unit = granularity === 'day' ? 'week' : granularity;
    const rows = await this.query(`
      WITH filtered AS (SELECT * FROM history ${this.where(filters)}),
      leaders AS (
        SELECT artist FROM filtered GROUP BY artist ORDER BY SUM(${this.metric()}) DESC LIMIT 5
      ), totals AS (
        SELECT CAST(DATE_TRUNC('${unit}', played_at) AS VARCHAR) AS period, artist, SUM(${this.metric()}) AS value
        FROM filtered GROUP BY 1, 2
      ), ranked AS (
        SELECT *, DENSE_RANK() OVER (PARTITION BY period ORDER BY value DESC) AS rank FROM totals
      )
      SELECT period, artist, rank, value FROM ranked
      WHERE artist IN (SELECT artist FROM leaders)
      ORDER BY period, rank
    `);
    return rows.map((row) => ({
      period: String(row.period).slice(0, 10), artist: String(row.artist), rank: asNumber(row.rank), value: asNumber(row.value),
    }));
  }

  private async cumulative(filters: Filters): Promise<TimePoint[]> {
    const rows = await this.query(`
      WITH monthly AS (
        SELECT CAST(DATE_TRUNC('month', played_at) AS VARCHAR) AS period, SUM(${this.metric()}) AS value
        FROM history ${this.where(filters)} GROUP BY 1
      )
      SELECT period, value, SUM(value) OVER (ORDER BY period) AS cumulative FROM monthly ORDER BY period
    `);
    return rows.map((row) => ({ period: String(row.period).slice(0, 10), value: asNumber(row.value), cumulative: asNumber(row.cumulative) }));
  }

  private async patterns(filters: Filters): Promise<[HeatCell[], CalendarCell[], DayPeriod[]]> {
    const [heatRows, calendarRows, periodRows] = await Promise.all([
      this.query(`SELECT EXTRACT(ISODOW FROM played_at)::INTEGER AS weekday, EXTRACT(HOUR FROM played_at)::INTEGER AS hour, SUM(${this.metric()}) AS value FROM history ${this.where(filters)} GROUP BY 1,2 ORDER BY 1,2`),
      this.query(`SELECT CAST(played_at AS DATE)::VARCHAR AS day, SUM(${this.metric()}) AS value, COUNT(*) AS plays FROM history ${this.where(filters)} GROUP BY 1 ORDER BY 1`),
      this.query(`
        SELECT CASE
          WHEN EXTRACT(HOUR FROM played_at) BETWEEN 5 AND 11 THEN 'Manhã'
          WHEN EXTRACT(HOUR FROM played_at) BETWEEN 12 AND 17 THEN 'Tarde'
          WHEN EXTRACT(HOUR FROM played_at) BETWEEN 18 AND 23 THEN 'Noite'
          ELSE 'Madrugada' END AS name,
          SUM(${this.metric()}) AS value
        FROM history ${this.where(filters)} GROUP BY 1
      `),
    ]);
    return [
      heatRows.map((row) => ({ weekday: asNumber(row.weekday), hour: asNumber(row.hour), value: asNumber(row.value) })),
      calendarRows.map((row) => ({ day: String(row.day).slice(0, 10), value: asNumber(row.value), plays: asNumber(row.plays) })),
      periodRows.map((row) => ({ name: String(row.name), value: asNumber(row.value) })),
    ];
  }

  private async discovery(filters: Filters, granularity: Granularity): Promise<[DiscoveryPoint[], LoyalArtist[]]> {
    const unit = granularity === 'day' ? 'month' : granularity;
    const start = quoteLiteral(filters.startDate);
    const end = quoteLiteral(filters.endDate);
    const identityWhere = this.where({ ...filters, startDate: '', endDate: '', yearMonth: '' }, undefined, false);
    const [newRows, loyalRows] = await Promise.all([
      this.query(`
        WITH first_seen AS (
          SELECT artist, MIN(played_at) AS first_date FROM history ${identityWhere} GROUP BY artist
        )
        SELECT CAST(DATE_TRUNC('${unit}', first_date) AS VARCHAR) AS period, COUNT(*) AS count
        FROM first_seen
        WHERE first_date >= ${start}::DATE AND first_date < (${end}::DATE + INTERVAL 1 DAY)
        GROUP BY 1 ORDER BY 1
      `),
      this.query(`
        SELECT artist, COUNT(DISTINCT EXTRACT(YEAR FROM played_at)) AS years,
          MIN(EXTRACT(YEAR FROM played_at)) AS first_year, MAX(EXTRACT(YEAR FROM played_at)) AS last_year
        FROM history ${this.where(filters)}
        GROUP BY artist ORDER BY years DESC, SUM(${this.metric()}) DESC LIMIT 10
      `),
    ]);
    return [
      newRows.map((row) => ({ period: String(row.period).slice(0, 10), count: asNumber(row.count) })),
      loyalRows.map((row) => ({ artist: String(row.artist), years: asNumber(row.years), firstYear: asNumber(row.first_year), lastYear: asNumber(row.last_year) })),
    ];
  }

  async dashboard(filters: Filters, granularity: Granularity): Promise<DashboardData> {
    const days = Math.max(1, differenceInCalendarDays(parseISO(filters.endDate), parseISO(filters.startDate)) + 1);
    const previousEnd = subDays(parseISO(filters.startDate), 1);
    const previous = { startDate: format(subDays(previousEnd, days - 1), 'yyyy-MM-dd'), endDate: format(previousEnd, 'yyyy-MM-dd') };
    const [
      currentKpis, previousKpis, topArtists, topTracks, topAlbums,
      evolution, bump, cumulative, patterns, discovery,
    ] = await Promise.all([
      this.kpis(filters), this.kpis(filters, previous), this.top(filters, 'artists'), this.top(filters, 'tracks'), this.top(filters, 'albums'),
      this.evolution(filters, granularity), this.bump(filters, granularity), this.cumulative(filters), this.patterns(filters), this.discovery(filters, granularity),
    ]);
    return {
      kpis: { ...currentKpis, previous: previousKpis },
      topArtists, topTracks, topAlbums, evolution, bump, cumulative,
      heatmap: patterns[0], calendar: patterns[1], dayPeriods: patterns[2], discovery: discovery[0], loyal: discovery[1],
    };
  }

  async filterOptions(): Promise<{ artists: FilterOption[]; albums: FilterOption[]; months: string[] }> {
    const [artists, albums, months] = await Promise.all([
      this.query(`SELECT artist AS value, COUNT(*) AS count FROM history GROUP BY artist ORDER BY count DESC LIMIT 500`),
      this.query(`SELECT album AS value, COUNT(*) AS count FROM history WHERE album <> 'Sem álbum' GROUP BY album ORDER BY count DESC LIMIT 500`),
      this.query(`SELECT DISTINCT strftime(played_at, '%Y-%m') AS month FROM history ORDER BY month DESC`),
    ]);
    return {
      artists: artists.map((row) => ({ value: String(row.value), count: asNumber(row.count) })),
      albums: albums.map((row) => ({ value: String(row.value), count: asNumber(row.count) })),
      months: months.map((row) => String(row.month)),
    };
  }
}

export const analytics = new LocalAnalytics();
