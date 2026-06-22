import { useEffect, useMemo, useState } from 'react';
import {
  Home as HomeIcon,
  Library as LibraryIcon,
  Download,
  Newspaper,
  ExternalLink,
  Star,
} from 'lucide-react';
import { NavLink } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useGameStore } from '../data/GameStore';
import { useFavorites } from '../data/useFavorites';
import { useNews } from '../data/useNews';
import { isOfflineMode } from '../utils/externalLink';
import type { Game } from '../types/game';

interface SidebarItem {
  to: string;
  label: string;
  Icon: typeof HomeIcon;
}

const baseItems: SidebarItem[] = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/library', label: 'Library', Icon: LibraryIcon },
  { to: '/installed', label: 'Installed', Icon: Download },
  { to: '/externals', label: 'External Games', Icon: ExternalLink },
  { to: '/favorites', label: 'Favorites', Icon: Star },
  { to: '/news', label: 'News', Icon: Newspaper },
];

export const SIDEBAR_WIDTH_CLASS = 'pl-16';

const navItemBaseClass =
  'relative flex items-center justify-center w-11 h-11 rounded-lg transition-colors';

export function Sidebar() {
  const { user } = useAuth();
  const { games, getVisibleGames } = useGameStore();
  const { favorites } = useFavorites(user?.uid);
  const { posts } = useNews();

  const [isInCEF, setIsInCEF] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setIsInCEF(typeof (window as any).GetPlatform === 'function');
  }, []);

  useEffect(() => {
    if (!isInCEF) return;
    const id = setInterval(() => setTick(t => t + 1), 1500);
    return () => clearInterval(id);
  }, [isInCEF]);

  const visibleGames = useMemo(
    () => getVisibleGames(user?.role, user?.assignedGames || []),
    [games, user, getVisibleGames],
  );

  const installedCount = useMemo(() => {
    const w = window as any;
    if (typeof w.isIsoInstalled !== 'function') return 0;
    return visibleGames.filter((g: Game) => !!w.isIsoInstalled(g.recompName)).length;
  }, [visibleGames, isInCEF]);

  const externalsCount = useMemo(
    () => visibleGames.filter(g => !!g.externalLauncherUrl).length,
    [visibleGames],
  );

  const favoritesCount = useMemo(() => {
    const ids = new Set(visibleGames.map(g => g.id));
    return favorites.filter(id => ids.has(id)).length;
  }, [favorites, visibleGames]);

  const isDevOrAdmin = user?.role === 'admin' || user?.role === 'developer';
  const newsCount = posts.length;

  const items = useMemo(() => {
    return baseItems.filter(item => {
      switch (item.to) {
        case '/installed':
          return installedCount > 0;
        case '/externals':
          return externalsCount > 0;
        case '/favorites':
          return favoritesCount > 0;
        case '/news':
          return newsCount > 0 || isDevOrAdmin;
        default:
          return true;
      }
    });
  }, [installedCount, externalsCount, favoritesCount, newsCount, isDevOrAdmin]);

  return (
    <aside
      className="fixed top-0 left-0 z-40 h-screen w-16 flex flex-col items-center py-3 border-r overflow-hidden"
      style={{
        backgroundColor: 'var(--theme-topbar-bg)',
        borderColor: 'var(--theme-border)',
        backdropFilter: 'var(--theme-backdrop-blur)',
        WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
      }}
    >
      {/* Profile — very top */}
      {(() => {
        const avatar = (
          <span
            className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden text-white font-bold text-sm"
            style={!user?.picture ? {
              background: `linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))`,
            } : undefined}
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.username}
                className="w-9 h-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              user?.username?.[0]?.toUpperCase() || '?'
            )}
          </span>
        );

        // Sign-in requires Firestore/Firebase Auth, neither of which is
        // reachable in offline mode — link to /profile would just dead-end
        // on a broken sign-in page, so render it as a disabled placeholder.
        if (isOfflineMode()) {
          return (
            <div
              title="Sign-in isn't available in offline mode"
              aria-label="Sign-in isn't available in offline mode"
              className={`${navItemBaseClass} opacity-40 cursor-not-allowed`}
            >
              {avatar}
            </div>
          );
        }

        return (
          <NavLink
            to="/profile"
            title={user?.username || 'Profile'}
            aria-label={user?.username || 'Profile'}
            className={navItemBaseClass}
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--theme-item-selected)' : 'transparent',
            })}
          >
            {avatar}
          </NavLink>
        );
      })()}

      <div
        className="my-2 h-px w-8"
        style={{ backgroundColor: 'var(--theme-border)' }}
        aria-hidden
      />

      {/* Main nav */}
      <nav className="flex flex-col items-center gap-2 flex-1 overflow-y-auto overflow-x-hidden w-full">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            aria-label={label}
            className={navItemBaseClass}
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--theme-item-selected)' : 'transparent',
              color: 'var(--theme-text-primary)',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r"
                    style={{
                      background: `linear-gradient(to bottom, var(--theme-gradient-from), var(--theme-gradient-to))`,
                    }}
                  />
                )}
                <Icon className="w-5 h-5" />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
