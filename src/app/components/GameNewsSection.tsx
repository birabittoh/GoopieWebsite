import { useState } from 'react';
import { ChevronDown, Newspaper } from 'lucide-react';
import { Markdown } from './Markdown';
import type { NewsPost } from '../data/useNews';

function formatNewsDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function GameNewsHeader({ post }: { post: NewsPost }) {
  const images = (post.thumbnails && post.thumbnails.length > 0)
    ? post.thumbnails
    : (post.thumbnail ? [post.thumbnail] : []);
  const [imgIdx, setImgIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const displayDate = post.publishedAt ?? post.createdAt;
  const tags = post.tags || [];
  const cover = images[imgIdx];
  return (
    <article
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-page-bg)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        style={{ color: 'var(--theme-text-primary)' }}
      >
        <div className="flex flex-col min-w-0">
          <span className="font-semibold truncate">{post.title || 'Untitled'}</span>
          <span className="text-xs opacity-60">
            {formatNewsDate(displayDate)}{post.authorName ? ` • ${post.authorName}` : ''}
          </span>
        </div>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {expanded && (
        <div>
      {cover && (
        <div className="relative w-full" style={{ aspectRatio: '21 / 9', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <img
            key={imgIdx}
            src={cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-x-0 bottom-0 p-4 md:p-6"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 100%)',
              color: '#fff',
            }}
          >
            <h3 className="text-xl md:text-3xl font-bold leading-tight drop-shadow">
              {post.title || 'Untitled'}
            </h3>
            <div className="text-xs md:text-sm opacity-90 mt-1">
              {formatNewsDate(displayDate)}
              {post.authorName ? ` • ${post.authorName}` : ''}
            </div>
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                aria-label="Previous image"
                className="absolute top-1/2 -translate-y-1/2 left-2 p-1.5 rounded-full hover:opacity-90"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                aria-label="Next image"
                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-full hover:opacity-90"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    aria-label={`Go to image ${i + 1}`}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#fff', opacity: i === imgIdx ? 1 : 0.45 }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="p-4 md:p-6">
        {!cover && (
          <header className="mb-3">
            <h3 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
              {post.title || 'Untitled'}
            </h3>
            <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              {formatNewsDate(displayDate)}
              {post.authorName ? ` • ${post.authorName}` : ''}
            </div>
          </header>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded text-[11px] font-medium"
                style={{
                  backgroundColor: 'var(--theme-item-selected)',
                  color: 'var(--theme-text-primary)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div style={{ color: 'var(--theme-text-secondary)' }}>
          <Markdown source={post.body || ''} />
        </div>
      </div>
        </div>
      )}
    </article>
  );
}

export function GameNewsSection({ posts }: { posts: NewsPost[] }) {
  if (!posts || posts.length === 0) return null;
  const ordered = [...posts].sort((a, b) => {
    const da = a.publishedAt ?? a.createdAt;
    const db = b.publishedAt ?? b.createdAt;
    return db - da;
  });
  return (
    <div
      className="p-6 rounded-lg shadow"
      style={{
        backgroundColor: 'var(--theme-card-bg)',
        backdropFilter: 'var(--theme-backdrop-blur)',
        WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
      }}
    >
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
        <Newspaper className="w-5 h-5" /> News
      </h2>
      <div className="space-y-3">
        {ordered.map((post) => (
          <GameNewsHeader key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
