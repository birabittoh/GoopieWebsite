import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, Platform } from '../types/game';
import { Plus, Filter, Star, GripVertical } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Checkbox } from './ui/checkbox';
import type { GameRatingInfo } from '../data/useRatings';
import { useCoverStyle } from '../hooks/useCoverStyle';

const statusColors: Record<Game['status'], string> = {
  Featured: 'bg-purple-600 text-white',
  Enhanced: 'bg-blue-500 text-white',
  Playable: 'bg-green-700 text-white',
  Gameplay: 'bg-green-400 text-black',
  Loads: 'bg-orange-500 text-white',
  Unplayable: 'bg-red-500 text-white',
  Unknown: 'bg-gray-600 text-white',
};

const statusDescriptions: Record<Game['status'], string> = {
  Featured: 'Creator curated — Enhanced and recommended by the Rexglue team',
  Enhanced: 'Playable with enhancements like mods or texture packs',
  Playable: 'Works from start to finish with minor issues',
  Gameplay: 'Can get into gameplay, completion unknown',
  Loads: 'Reaches the main menu',
  Unplayable: 'Crashes too much or has major issues',
  Unknown: 'Untested',
};

const ALL_STATUSES: Game['status'][] = ['Featured', 'Enhanced', 'Playable', 'Gameplay', 'Loads', 'Unplayable', 'Unknown'];
const ALL_PLATFORMS: Platform[] = ['Windows', 'Linux', 'Mac'];

const PlatformIcon = ({ platform, className }: { platform: Platform; className?: string }) => {
  switch (platform) {
    case 'Windows':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--theme-text-secondary)' }}>
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
        </svg>
      );
    case 'Linux':
      return (
        <img src="https://x02.me/i/CFDAR.png" alt="Linux" className={className} style={{ filter: 'var(--theme-text-secondary, none)' }} />
      );
    case 'Mac':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--theme-text-secondary)' }}>
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      );
  }
};

interface GameListProps {
  games: Game[];
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
  onCreateGame?: () => void;
  statusFilters: Game['status'][];
  onStatusFiltersChange: (statuses: Game['status'][]) => void;
  tagFilters: string[];
  onTagFiltersChange: (tags: string[]) => void;
  hideExternal: boolean;
  onHideExternalChange: (hide: boolean) => void;
  allTags: string[];
  platformFilters: Platform[];
  onPlatformFiltersChange: (platforms: Platform[]) => void;
  gameRatings?: Record<string, GameRatingInfo>;
  /** User-controlled favorites order, from useFavorites. */
  favoriteIds?: string[];
  /** Reorder callback using indices into `favoriteIds`. */
  onReorderFavorites?: (fromIndex: number, toIndex: number) => void;
  className?: string;
}

export function GameList({ games, selectedGameId, onSelectGame, onCreateGame, statusFilters, onStatusFiltersChange, tagFilters, onTagFiltersChange, hideExternal, onHideExternalChange, allTags, platformFilters, onPlatformFiltersChange, gameRatings, favoriteIds, onReorderFavorites, className }: GameListProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [dragFavId, setDragFavId] = useState<string | null>(null);
  const favListRef = useRef<HTMLDivElement>(null);
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);

  const findFavId = useCallback((el: Element | null): string | null => {
    while (el && el !== favListRef.current) {
      if (el instanceof HTMLElement && el.dataset.favId) return el.dataset.favId;
      el = el.parentElement;
    }
    return null;
  }, []);

  useEffect(() => {
    const canDrag = !!onReorderFavorites;
    if (!canDrag) return;

    const onMove = (e: PointerEvent) => {
      if (pendingDrag.current) {
        const dx = e.clientX - pendingDrag.current.x;
        const dy = e.clientY - pendingDrag.current.y;
        if (dx * dx + dy * dy > 25) {
          setDragFavId(pendingDrag.current.id);
          pendingDrag.current = null;
        }
        return;
      }
      if (!dragFavId) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetId = findFavId(target);
      if (targetId && targetId !== dragFavId && favoriteIds && onReorderFavorites) {
        const from = favoriteIds.indexOf(dragFavId);
        const to = favoriteIds.indexOf(targetId);
        if (from !== -1 && to !== -1 && from !== to) onReorderFavorites(from, to);
      }
    };
    const onUp = () => {
      pendingDrag.current = null;
      if (!dragFavId) return;
      setDragFavId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [onReorderFavorites, dragFavId, findFavId, favoriteIds]);

  const favSet = new Set(favoriteIds ?? []);
  const favGames = games.filter(g => favSet.has(g.id));
  const otherGames = games.filter(g => !favSet.has(g.id));

  const toggleStatus = (status: Game['status']) => {
    if (statusFilters.includes(status)) {
      onStatusFiltersChange(statusFilters.filter(s => s !== status));
    } else {
      onStatusFiltersChange([...statusFilters, status]);
    }
  };

  const toggleTag = (tag: string) => {
    if (tagFilters.includes(tag)) {
      onTagFiltersChange(tagFilters.filter(t => t !== tag));
    } else {
      onTagFiltersChange([...tagFilters, tag]);
    }
  };

  const togglePlatform = (platform: Platform) => {
    if (platformFilters.includes(platform)) {
      onPlatformFiltersChange(platformFilters.filter(p => p !== platform));
    } else {
      onPlatformFiltersChange([...platformFilters, platform]);
    }
  };

  return (
    <div className={`w-full md:w-80 h-full flex flex-col border-r ${className || ''}`} style={{ backgroundColor: 'var(--theme-sidebar-bg)', borderColor: 'var(--theme-border)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
      <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="w-8 h-8 rounded flex items-center justify-center transition-colors"
            style={{ backgroundColor: showFilters ? 'var(--theme-accent)' : 'var(--theme-item-selected)', color: showFilters ? 'white' : 'var(--theme-text-primary)' }}
            title="Toggle Filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          {onCreateGame && (
            <button
              onClick={onCreateGame}
              className="w-8 h-8 rounded text-white flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'var(--theme-accent)' }}
              title="Create New Game"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="p-4 border-b space-y-4 overflow-y-auto max-h-64" style={{ borderColor: 'var(--theme-border)' }}>
          {/* Status Filters */}
          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Status</div>
            <div className="space-y-1.5">
              {ALL_STATUSES.map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[status]}`}>{status}</span>
                  <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{statusDescriptions[status]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="px-2 py-0.5 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: tagFilters.includes(tag) ? 'var(--theme-accent)' : 'var(--theme-item-selected)',
                      color: tagFilters.includes(tag) ? 'white' : 'var(--theme-text-secondary)',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Platform Filters */}
          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Platform</div>
            <div className="space-y-1.5">
              {ALL_PLATFORMS.map(platform => (
                <label key={platform} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={platformFilters.includes(platform)}
                    onCheckedChange={() => togglePlatform(platform)}
                  />
                  <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
                  <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{platform}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hide External */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={hideExternal}
                onCheckedChange={(checked) => onHideExternalChange(!!checked)}
              />
              <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>Hide external games</span>
            </label>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {favGames.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-1 pt-1 pb-2">
                <Star className="w-3.5 h-3.5" style={{ color: '#facc15' }} fill="#facc15" />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                  Favorites
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--theme-border)' }} />
              </div>
              <div ref={favListRef}>
              {favGames.map(game => {
                const isDragging = dragFavId === game.id;
                const canDrag = !!onReorderFavorites && favGames.length > 1;
                return (
                  <button
                    key={game.id}
                    data-fav-id={game.id}
                    onClick={() => { if (!dragFavId) onSelectGame(game.id); }}
                    onPointerDown={canDrag ? (e) => {
                      if (e.button !== 0) return;
                      if (!(e.target as HTMLElement).closest('[data-drag-handle]')) return;
                      e.preventDefault();
                      pendingDrag.current = { id: game.id, x: e.clientX, y: e.clientY };
                    } : undefined}
                    className="w-full text-left p-3 rounded mb-1 transition-colors"
                    style={{
                      backgroundColor: selectedGameId === game.id ? 'var(--theme-item-selected)' : 'var(--theme-item-default)',
                      opacity: isDragging ? 0.5 : 1,
                      cursor: dragFavId ? 'grabbing' : undefined,
                    }}
                    onMouseEnter={e => { if (selectedGameId !== game.id) e.currentTarget.style.backgroundColor = 'var(--theme-item-hover)'; }}
                    onMouseLeave={e => { if (selectedGameId !== game.id) e.currentTarget.style.backgroundColor = 'var(--theme-item-default)'; }}
                  >
                    <GameRow game={game} gameRatings={gameRatings} showDragHandle={canDrag} />
                  </button>
                );
              })}
              </div>
              {otherGames.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-3 pb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                    All Games
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--theme-border)' }} />
                </div>
              )}
            </>
          )}
          {otherGames.map((game) => (
            <button
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="w-full text-left p-3 rounded mb-1 transition-colors"
              style={{
                backgroundColor: selectedGameId === game.id ? 'var(--theme-item-selected)' : 'var(--theme-item-default)',
              }}
              onMouseEnter={e => { if (selectedGameId !== game.id) e.currentTarget.style.backgroundColor = 'var(--theme-item-hover)'; }}
              onMouseLeave={e => { if (selectedGameId !== game.id) e.currentTarget.style.backgroundColor = 'var(--theme-item-default)'; }}
            >
              <GameRow game={game} gameRatings={gameRatings} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface GameRowProps {
  game: Game;
  gameRatings?: Record<string, GameRatingInfo>;
  showDragHandle?: boolean;
}

function GameRow({ game, gameRatings, showDragHandle }: GameRowProps) {
  const coverStyle = useCoverStyle(game.coverImage);
  return (
    <div className="flex gap-3">
      {showDragHandle && (
        <span
          data-drag-handle
          className="flex items-center justify-center shrink-0"
          style={{ color: 'var(--theme-text-muted)', cursor: 'grab' }}
          aria-hidden
        >
          <GripVertical className="w-4 h-4" />
        </span>
      )}
      <div
        className="w-20 h-28 rounded shrink-0"
        role="img"
        aria-label={game.title}
        style={{
          backgroundColor: '#000',
          backgroundImage: `url(${game.coverImage})`,
          backgroundSize: coverStyle.backgroundSize,
          backgroundPosition: coverStyle.backgroundPosition,
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <h3 className="font-semibold text-sm break-words" style={{ color: 'var(--theme-text-primary)' }}>
            {game.title}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusColors[game.status]} cursor-default`}>
                {game.status}
              </span>
            </TooltipTrigger>
            <TooltipContent>{statusDescriptions[game.status]}</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
          {game.Tags.join(', ')}
        </p>
        {gameRatings?.[game.id] && gameRatings[game.id].totalRatings > 0 && (
          <div className="flex items-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                className="w-3 h-3"
                fill={s <= Math.round(gameRatings[game.id].averageRating) ? '#facc15' : 'transparent'}
                stroke={s <= Math.round(gameRatings[game.id].averageRating) ? '#facc15' : 'var(--theme-text-muted)'}
              />
            ))}
            <span className="text-[10px] ml-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              {gameRatings[game.id].averageRating.toFixed(1)} ({gameRatings[game.id].totalRatings})
            </span>
          </div>
        )}
        {game.platforms && game.platforms.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {game.platforms.map(p => (
              <Tooltip key={p}>
                <TooltipTrigger asChild>
                  <span className="cursor-default" style={{ color: 'var(--theme-text-muted)' }}>
                    <PlatformIcon platform={p} className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{p}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
