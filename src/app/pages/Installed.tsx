import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Sidebar, SIDEBAR_WIDTH_CLASS } from '../components/Sidebar';
import { Footer } from '../components/Footer';
import { GameGrid } from '../components/GameGrid';
import { useGameStore } from '../data/GameStore';
import { useAuth } from '../auth/AuthContext';
import { useRatings } from '../data/useRatings';
import type { Game } from '../types/game';

interface InstalledFilterPageProps {
  mode: 'installed' | 'uninstalled';
  title: string;
  subtitle: string;
  emptyMessage: string;
}

export function InstalledFilterPage({ mode, title, subtitle, emptyMessage }: InstalledFilterPageProps) {
  const { user } = useAuth();
  const { games, getVisibleGames } = useGameStore();
  const { gameRatings } = useRatings(user?.uid);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInCEF, setIsInCEF] = useState(false);
  // tick to refresh installed status when CEF state changes
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
    [games, user, getVisibleGames]
  );

  const filtered = useMemo(() => {
    const w = window as any;
    const isInstalled = (g: Game) =>
      typeof w.isIsoInstalled === 'function' ? !!w.isIsoInstalled(g.recompName) : false;

    const statusOrder: Record<Game['status'], number> = {
      Featured: 0,
      Enhanced: 1,
      Playable: 2,
      Gameplay: 3,
      Loads: 4,
      Unplayable: 5,
      Unknown: 6,
    };

    return visibleGames
      .filter(g => (mode === 'installed' ? isInstalled(g) : !isInstalled(g)))
      .filter(g => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return g.title.toLowerCase().includes(q) || g.og_developer.toLowerCase().includes(q);
      })
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [visibleGames, mode, searchQuery]);

  const effectiveEmpty = !isInCEF && mode === 'installed'
    ? 'Install the Goopie Launcher to see your installed games here.'
    : emptyMessage;

  return (
    <div
      className={`min-h-screen flex flex-col ${SIDEBAR_WIDTH_CLASS}`}
      style={{ backgroundColor: 'var(--theme-page-bg)', color: 'var(--theme-text-primary)' }}
    >
      <Sidebar />
      <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} isInCEF={isInCEF} />

      <section className="px-4 md:px-10 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
            {title}
          </h2>
          <p className="text-sm md:text-base mb-8" style={{ color: 'var(--theme-text-secondary)' }}>
            {filtered.length > 0
              ? `${filtered.length} ${filtered.length === 1 ? 'game' : 'games'} • ${subtitle}`
              : subtitle}
          </p>
          <GameGrid games={filtered} ratings={gameRatings} emptyMessage={effectiveEmpty} />
        </div>
      </section>
      <Footer />
    </div>
  );
}

export function Installed() {
  return (
    <InstalledFilterPage
      mode="installed"
      title="Installed"
      subtitle="Games you've installed locally through the Goopie Launcher."
      emptyMessage="You haven't installed any games yet."
    />
  );
}

export function Uninstalled() {
  return (
    <InstalledFilterPage
      mode="uninstalled"
      title="Uninstalled"
      subtitle="Games available to install."
      emptyMessage="Every available game is installed."
    />
  );
}
