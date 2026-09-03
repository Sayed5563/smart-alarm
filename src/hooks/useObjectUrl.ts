import { useEffect, useState } from 'react';

/** Turn a Blob (or a loader that returns one) into an object URL that is
 *  revoked automatically on unmount / change. */
export function useObjectUrl(loader: () => Promise<Blob | undefined> | Blob | undefined, deps: unknown[]): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let current: string | null = null;
    Promise.resolve(loader())
      .then((blob) => {
        if (cancelled || !blob) return;
        current = URL.createObjectURL(blob);
        setUrl(current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
      setUrl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return url;
}
