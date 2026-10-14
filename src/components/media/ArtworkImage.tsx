import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import type { RankedItem } from '../../types';
import { fallbackArtwork, resolveArtwork, resolveBackupArtwork, type ArtworkKind } from '../../lib/artwork';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  item: RankedItem;
  kind: ArtworkKind;
}

export function ArtworkImage({ item, kind, alt = '', onError, ...props }: Props) {
  const fallback = fallbackArtwork(item.name, kind);
  const [source, setSource] = useState(item.imageUrl || fallback);
  const backupAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    backupAttempted.current = false;
    setSource(item.imageUrl || fallback);
    void resolveArtwork(item, kind).then((url) => { if (!cancelled) setSource(url); });
    return () => { cancelled = true; };
  }, [item.name, item.artist, item.imageUrl, item.mbid, kind, fallback]);

  return <img
    {...props}
    src={source}
    alt={alt}
    decoding="async"
    referrerPolicy="no-referrer"
    onError={(event) => {
      if (source !== fallback && !backupAttempted.current) {
        backupAttempted.current = true;
        setSource(fallback);
        void resolveBackupArtwork(item, kind).then(setSource);
      } else if (source !== fallback) setSource(fallback);
      onError?.(event);
    }}
  />;
}
