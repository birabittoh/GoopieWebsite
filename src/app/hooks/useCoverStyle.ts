import { useEffect, useState } from 'react';

const landscapeCache = new Map<string, boolean>();

export function useCoverStyle(src: string | undefined): {
  backgroundSize: string;
  backgroundPosition: string;
} {
  const [isLandscape, setIsLandscape] = useState<boolean | null>(
    src ? (landscapeCache.get(src) ?? null) : null
  );

  useEffect(() => {
    if (!src) return;
    if (landscapeCache.has(src)) {
      setIsLandscape(landscapeCache.get(src)!);
      return;
    }
    const img = new Image();
    img.src = src;
    const onLoad = () => {
      const landscape = img.naturalWidth > img.naturalHeight;
      landscapeCache.set(src, landscape);
      setIsLandscape(landscape);
    };
    if (img.complete && img.naturalWidth > 0) {
      onLoad();
    } else {
      img.addEventListener('load', onLoad);
      return () => img.removeEventListener('load', onLoad);
    }
  }, [src]);

  if (isLandscape === false) {
    return { backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { backgroundSize: '211% 100%', backgroundPosition: 'right center' };
}

export function useCoverStyleMap(srcs: (string | undefined)[]): Map<string, { backgroundSize: string; backgroundPosition: string }> {
  const [, setTick] = useState(0);

  useEffect(() => {
    const pending: { img: HTMLImageElement; handler: () => void }[] = [];
    let changed = false;
    for (const src of srcs) {
      if (!src || landscapeCache.has(src)) continue;
      const img = new Image();
      img.src = src;
      const handler = () => {
        const landscape = img.naturalWidth > img.naturalHeight;
        landscapeCache.set(src, landscape);
        changed = true;
        setTick(t => t + 1);
      };
      if (img.complete && img.naturalWidth > 0) {
        landscapeCache.set(src, img.naturalWidth > img.naturalHeight);
        changed = true;
      } else {
        img.addEventListener('load', handler);
        pending.push({ img, handler });
      }
    }
    if (changed) setTick(t => t + 1);
    return () => {
      for (const { img, handler } of pending) {
        img.removeEventListener('load', handler);
      }
    };
  }, [srcs.join(',')]);

  const result = new Map<string, { backgroundSize: string; backgroundPosition: string }>();
  for (const src of srcs) {
    if (!src) continue;
    const isLandscape = landscapeCache.get(src);
    if (isLandscape === false) {
      result.set(src, { backgroundSize: 'cover', backgroundPosition: 'center' });
    } else {
      result.set(src, { backgroundSize: '211% 100%', backgroundPosition: 'right center' });
    }
  }
  return result;
}
