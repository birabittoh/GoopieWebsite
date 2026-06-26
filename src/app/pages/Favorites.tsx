import { useCallback, useMemo, useState } from 'react';
import { Star, X } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Sidebar, SIDEBAR_WIDTH_CLASS } from '../components/Sidebar';
import { GameGrid } from '../components/GameGrid';
import { Footer } from '../components/Footer';
import { useAuth } from '../auth/AuthContext';
import { useGameStore } from '../data/GameStore';
import { useRatings } from '../data/useRatings';
import { useFavorites } from '../data/useFavorites';
import type { Game } from '../types/game';

export function Favorites() {
  const { user } = useAuth();
  const { games, getVisibleGames } = useGameStore();
  const { gameRatings } = useRatings(user?.uid);
  const { favorites, reorderFavorites, removeFavorite } = useFavorites(user?.uid);

  const [searchQuery, setSearchQuery] = useState('');

  const visibleGames = useMemo(
    () => getVisibleGames(user?.role, user?.assignedGames || []),
    [games, user, getVisibleGames],
  );

  const orderedFavorites = useMemo<Game[]>(() => {
    const byId = new Map(visibleGames.map(g => [g.id, g]));
    const result: Game[] = [];
    for (const id of favorites) {
      const g = byId.get(id);
      if (!g) continue;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!g.title.toLowerCase().includes(q) && !g.og_developer.toLowerCase().includes(q)) {
          continue;
        }
      }
      result.push(g);
    }
    return result;
  }, [favorites, visibleGames, searchQuery]);

  const handleReorder = useCallback((fromId: string, toId: string) => {
    const from = favorites.indexOf(fromId);
    const to = favorites.indexOf(toId);
    if (from === -1 || to === -1) return;
    reorderFavorites(from, to);
  }, [favorites, reorderFavorites]);

  const subtitle = searchQuery
    ? 'Filtered by your search.'
    : 'Drag any cover to reorder.' + (!user ? ' Sign in to sync across devices.' : '');

  const emptyMessage =
    favorites.length === 0
      ? 'No favorites yet. Tap the star on any game to bookmark it.'
      : 'No favorites match your search.';

  return (
    <div
      className={`min-h-screen flex flex-col ${SIDEBAR_WIDTH_CLASS}`}
      style={{ backgroundColor: 'var(--theme-page-bg)', color: 'var(--theme-text-primary)' }}
    >
      <Sidebar />
      <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <section className="px-4 md:px-10 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-7 h-7" style={{ color: 'var(--theme-text-primary)' }} />
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
              Favorites
            </h2>
          </div>
          <p className="text-sm md:text-base mb-8" style={{ color: 'var(--theme-text-secondary)' }}>
            {orderedFavorites.length > 0
              ? `${orderedFavorites.length} ${orderedFavorites.length === 1 ? 'game' : 'games'} • ${subtitle}`
              : subtitle}
          </p>

          <GameGrid
            games={orderedFavorites}
            ratings={gameRatings}
            emptyMessage={emptyMessage}
            draggableItems={!searchQuery}
            onReorder={handleReorder}
            renderOverlay={(game) => (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeFavorite(game.id);
                }}
                className="absolute top-2 left-2 z-10 flex items-center justify-center w-8 h-8 rounded-full transition-opacity opacity-0 group-hover/card:opacity-100 focus:opacity-100"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  color: 'rgba(255,255,255,0.9)',
                }}
                title="Remove from favorites"
                aria-label={`Remove ${game.title} from favorites`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          />
        </div>
      </section>
      <Footer />
    </div>
  );
}
