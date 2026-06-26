import { useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../types/game';

interface CoverArtBackgroundProps {
  games: Game[];
  tileWidth?: number;
  angle?: number;
  overlayOpacity?: number;
  overlayColor?: string;
  rows?: number;
  speed?: number;
  zIndex?: number;
}

function hash(n: number) {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

export function CoverArtBackground({
  games,
  tileWidth = 180,
  angle = 22,
  overlayOpacity = 0.78,
  overlayColor,
  rows = 11,
  speed = 18,
  zIndex = 0,
}: CoverArtBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [parentSize, setParentSize] = useState({ w: 0, h: 0 });

  const covers = useMemo(
    () => games
      .filter(g => g.isPublic !== false && !g.pendingApproval && g.coverImage)
      .map(g => g.coverImage as string),
    [games]
  );

  useEffect(() => {
    // Measure the container itself (absolute inset-0 inside the hero) rather
    // than the hero's content box — the hero has vertical padding which would
    // otherwise leave the canvas short of the full background area.
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const r = e.contentRect;
        setParentSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tileHeight = Math.round(tileWidth * (4 / 3));
  const diag = Math.ceil(Math.sqrt(parentSize.w ** 2 + parentSize.h ** 2));
  const stripWidth = Math.max(diag + tileWidth * 4, tileWidth * 8);
  const stripHeight = rows * tileHeight;
  const cols = Math.max(2, Math.ceil(stripWidth / tileWidth) + 2);

  const rowData = useMemo(() => {
    if (covers.length === 0) return [];
    const out: { srcs: string[]; initialOffset: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const order = covers.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(hash(r * 1000 + i) * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const srcs: string[] = [];
      for (let c = 0; c < cols; c++) srcs.push(order[c % order.length]);
      out.push({ srcs, initialOffset: hash(r * 7919 + 1) * tileWidth });
    }
    return out;
  }, [covers, rows, cols, tileWidth]);

  useEffect(() => {
    const cache = imageCacheRef.current;
    for (const src of covers) {
      if (cache.has(src)) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      cache.set(src, img);
    }
  }, [covers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rowData.length === 0 || parentSize.w === 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(parentSize.w * dpr);
    canvas.height = Math.round(parentSize.h * dpr);
    canvas.style.width = parentSize.w + 'px';
    canvas.style.height = parentSize.h + 'px';

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const cache = imageCacheRef.current;
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const positions: number[][] = rowData.map(row =>
      row.srcs.map((_, c) => c * tileWidth + row.initialOffset)
    );
    const angleRad = (angle * Math.PI) / 180;
    // Visual gap between tiles + corner radius so the wall reads as discrete
    // cover-art tiles rather than one giant collage.
    const gap = 6;
    const innerW = tileWidth - gap * 2;
    const innerH = tileHeight - gap * 2;
    const radius = 8;
    const supportsRoundRect = typeof (CanvasRenderingContext2D.prototype as any).roundRect === 'function';

    let visible = true;
    let tabVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    let raf = 0;
    let last = performance.now();

    const draw = (dt: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.setTransform(dpr, 0, 0, dpr, (parentSize.w * dpr) / 2, (parentSize.h * dpr) / 2);
      ctx.rotate(angleRad);
      ctx.translate(-stripWidth / 2, -stripHeight / 2);

      // Tiles in each row are spaced exactly `tileWidth` apart, so the
      // natural repeat period is `cols * tileWidth`. Wrapping by anything
      // else (e.g. `stripWidth + tileWidth`) leaves a sub-pixel/tile gap or
      // overlap each time a tile cycles, which is what was causing visibly
      // overlapping cases in the background.
      const period = cols * tileWidth;
      for (let r = 0; r < rowData.length; r++) {
        const row = rowData[r];
        const dir = r % 2 === 0 ? -1 : 1;
        const dx = dir * speed * dt;
        const rowPositions = positions[r];
        const y = r * tileHeight;
        for (let c = 0; c < rowPositions.length; c++) {
          let x = rowPositions[c] + dx;
          if (x < -tileWidth) x += period;
          else if (x >= period - tileWidth) x -= period;
          rowPositions[c] = x;
          if (x + tileWidth < 0 || x > stripWidth) continue;

          const img = cache.get(row.srcs[c]);
          if (img && img.complete && img.naturalWidth > 0) {
            const dx0 = x + gap;
            const dy0 = y + gap;
            const isLandscape = img.naturalWidth > img.naturalHeight;
            let sX: number, sY: number, sW: number, sH: number;
            if (isLandscape) {
              const FRONT_RATIO = 700 / 1480;
              sW = img.naturalWidth * FRONT_RATIO;
              sH = img.naturalHeight;
              sX = img.naturalWidth - sW;
              sY = 0;
            } else {
              sX = 0;
              sY = 0;
              sW = img.naturalWidth;
              sH = img.naturalHeight;
            }
            if (supportsRoundRect) {
              ctx.save();
              ctx.beginPath();
              (ctx as any).roundRect(dx0, dy0, innerW, innerH, radius);
              ctx.clip();
              ctx.drawImage(img, sX, sY, sW, sH, dx0, dy0, innerW, innerH);
              ctx.restore();
            } else {
              ctx.drawImage(img, sX, sY, sW, sH, dx0, dy0, innerW, innerH);
            }
          }
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = overlayColor ?? `rgba(0,0,0,${overlayOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf || !visible || !tabVisible) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    draw(0);

    if (reduced) {
      let frames = 0;
      const recheck = () => {
        draw(0);
        frames++;
        if (frames < 120) raf = requestAnimationFrame(recheck);
      };
      raf = requestAnimationFrame(recheck);
      return () => stop();
    }

    const parent = containerRef.current?.parentElement;
    let io: IntersectionObserver | null = null;
    if (parent && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        entries => {
          for (const e of entries) visible = e.isIntersecting;
          if (visible) start(); else stop();
        },
        { threshold: 0 }
      );
      io.observe(parent);
    }

    const onVisibility = () => {
      tabVisible = document.visibilityState !== 'hidden';
      if (tabVisible) start(); else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    start();
    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [rowData, parentSize.w, parentSize.h, stripWidth, stripHeight, tileWidth, tileHeight, angle, speed, overlayOpacity, overlayColor]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none overflow-hidden"
      style={{ position: 'fixed', inset: 0, zIndex }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
