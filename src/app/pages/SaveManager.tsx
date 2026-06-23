import { useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useGameStore } from '../data/GameStore';
import { useBackgroundAccent } from '../theme/BackgroundAccentContext';
import { SaveManagerPanel } from '../components/SaveManagerPanel';

export function SaveManager() {
  const { recompName } = useParams<{ recompName: string }>();
  const { games } = useGameStore();
  const { setAccentColor } = useBackgroundAccent();

  const game = games.find(g => g.recompName.toLowerCase() === (recompName ?? '').toLowerCase());

  useEffect(() => {
    setAccentColor(game?.accentColor);
    return () => setAccentColor(undefined);
  }, [game?.accentColor, setAccentColor]);

  return (
    <div className="flex h-screen flex-col relative" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
      {/* Top bar */}
      <div
        className="h-16 border-b flex items-center px-6 gap-4 relative z-20 shrink-0"
        style={{ backgroundColor: 'var(--theme-topbar-bg)', borderColor: 'var(--theme-border)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}
      >
        <Link to={game ? `/library/${game.recompName}` : '/library'}>
          <Button variant="ghost" size="icon" className="shrink-0" style={{ color: 'var(--theme-text-primary)' }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold truncate flex-1 min-w-0" style={{ color: 'var(--theme-text-primary)' }}>
          Save Manager {game ? `— ${game.title}` : ''}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto p-8 relative z-10">
          {recompName && <SaveManagerPanel recompName={recompName} />}
        </div>
      </div>
    </div>
  );
}
