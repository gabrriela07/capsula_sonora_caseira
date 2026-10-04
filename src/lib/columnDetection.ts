import type { ColumnMapping, FieldKey, SchemaColumn } from '../types';

const aliases: Record<FieldKey, string[]> = {
  timestamp: ['ts', 'timestamp', 'played_at', 'playedat', 'datetime', 'date_time', 'date', 'date_1', 'endtime'],
  artist: ['master_metadata_album_artist_name', 'artist', 'artist_name', 'artistname', 'album_artist'],
  track: ['master_metadata_track_name', 'track', 'track_name', 'trackname', 'song', 'song_name', 'title'],
  album: ['master_metadata_album_album_name', 'album', 'album_name', 'albumname'],
  duration: ['ms_played', 'duration', 'duration_ms', 'milliseconds_played', 'msplayed', 'played_ms'],
};

const normalize = (value: string) => value.toLowerCase().trim().replace(/[\s.-]+/g, '_');

export function detectMapping(columns: SchemaColumn[]): ColumnMapping {
  const names = columns.map((column) => ({ original: column.name, normalized: normalize(column.name) }));
  const result = {} as ColumnMapping;
  (Object.keys(aliases) as FieldKey[]).forEach((field) => {
    const match = names.find(({ normalized }) => aliases[field].includes(normalized));
    result[field] = match?.original ?? '';
  });
  return result;
}

export function requiredMappingComplete(mapping: ColumnMapping): boolean {
  return Boolean(mapping.timestamp && mapping.artist && mapping.track);
}
