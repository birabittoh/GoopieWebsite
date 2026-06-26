import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Star } from 'lucide-react';
import { StarRating } from './StarRating';
import { useAuth } from '../auth/AuthContext';
import { useFavorites } from '../data/useFavorites';
import type { Game } from '../types/game';
import type { GameRatingInfo } from '../data/useRatings';
import { useCoverStyleMap } from '../hooks/useCoverStyle';

interface GameGridProps {
  games: Game[];
  ratings: Record<string, GameRatingInfo>;
  emptyMessage?: string;
  /** When true, enables pointer-based reordering. */
  draggableItems?: boolean;
  /** Called with (fromId, toId) when a card is dropped onto another. */
  onReorder?: (fromId: string, toId: string) => void;
  /** Optional overlay rendered on top of each card (e.g. remove button). */
  renderOverlay?: (game: Game) => React.ReactNode;
}

export function GameGrid({
  games,
  ratings,
  emptyMessage = 'No games found.',
  draggableItems = false,
  onReorder,
  renderOverlay,
}: GameGridProps) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites(user?.uid);
  const coverStyles = useCoverStyleMap(games.map(g => g.coverImage));

  const [dragId, setDragId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);

  const findGameId = useCallback((el: Element | null): string | null => {
    while (el && el !== gridRef.current) {
      if (el instanceof HTMLElement && el.dataset.gameId) return el.dataset.gameId;
      el = el.parentElement;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!draggableItems) return;

    const onMove = (e: PointerEvent) => {
      if (pendingDrag.current) {
        const dx = e.clientX - pendingDrag.current.x;
        const dy = e.clientY - pendingDrag.current.y;
        if (dx * dx + dy * dy > 25) {
          setDragId(pendingDrag.current.id);
          pendingDrag.current = null;
        }
        return;
      }
      if (!dragId) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetId = findGameId(target);
      if (targetId && targetId !== dragId) onReorder?.(dragId, targetId);
    };
    const onUp = () => {
      pendingDrag.current = null;
      if (!dragId) return;
      setDragId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggableItems, dragId, findGameId, onReorder]);

  if (games.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
      {games.map(game => {
        const rating = ratings[game.id];
        const fav = isFavorite(game.id);
        const wrap = game.coverImage;
        const coverStyle = wrap ? coverStyles.get(wrap) : undefined;
        const isBeingDragged = dragId === game.id;
        return (
          <div
            key={game.id}
            data-game-id={game.id}
            className="flex flex-col"
            onPointerDown={draggableItems ? (e) => {
              if (e.button !== 0) return;
              if ((e.target as HTMLElement).closest('a, button')) return;
              pendingDrag.current = { id: game.id, x: e.clientX, y: e.clientY };
            } : undefined}
            style={{
              opacity: isBeingDragged ? 0.5 : 1,
              cursor: dragId ? 'grabbing' : undefined,
            }}
          >
            <div
              className="relative w-full group/card"
              style={{ perspective: '1200px' }}
            >
              <Link
                to={`/library/${game.recompName}`}
                className={`block relative w-full aspect-[3/4] transition-transform duration-700 [transform-style:preserve-3d] ${draggableItems ? '' : 'group-hover/card:[transform:rotateY(180deg)] motion-reduce:group-hover/card:[transform:none]'}`}
              >
                {/* Front — front cover from the wrap (right portion) */}
                <div
                  className="absolute inset-0 rounded-sm overflow-hidden [backface-visibility:hidden]"
                  style={{
                    backgroundColor: '#000',
                    backgroundImage: `url(${wrap})`,
                    backgroundSize: coverStyle?.backgroundSize ?? '211% 100%',
                    backgroundPosition: coverStyle?.backgroundPosition ?? 'right center',
                    backgroundRepeat: 'no-repeat',
                    border: '1px solid var(--theme-border)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                  }}
                >
                  {/* Glossy case highlight */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(100deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 25%, rgba(255,255,255,0) 75%, rgba(0,0,0,0.20) 100%)',
                    }}
                  />
                </div>

                {!draggableItems && (
                  /* Back — back cover from the wrap (left portion) */
                  <div
                    className="absolute inset-0 rounded-sm overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]"
                    style={{
                      backgroundColor: '#000',
                      backgroundImage: `url(${wrap})`,
                      backgroundSize: coverStyle?.backgroundSize ?? '211% 100%',
                      backgroundPosition: coverStyle?.backgroundSize === 'cover' ? 'center' : 'left center',
                      backgroundRepeat: 'no-repeat',
                      border: '1px solid var(--theme-border)',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                    }}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(260deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 25%, rgba(255,255,255,0) 75%, rgba(0,0,0,0.20) 100%)',
                      }}
                    />
                  </div>
                )}
              </Link>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(game.id);
                }}
                className="absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full transition-opacity"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  color: fav ? '#facc15' : 'rgba(255,255,255,0.85)',
                  opacity: fav ? 1 : 0.85,
                }}
                title={fav ? 'Remove from favorites' : 'Add to favorites'}
                aria-label={fav ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
                aria-pressed={fav}
              >
                <Star className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
              </button>

              {renderOverlay?.(game)}
            </div>

            <Link
              to={`/library/${game.recompName}`}
              className="mt-1 flex flex-col"
            >
              <h3
                className="text-sm font-semibold leading-tight line-clamp-2"
                style={{ color: 'var(--theme-text-primary)' }}
                title={game.title}
              >
                {game.title}
              </h3>
              <StarRating
                averageRating={rating?.averageRating ?? 0}
                totalRatings={rating?.totalRatings ?? 0}
                readonly
                size="sm"
              />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
