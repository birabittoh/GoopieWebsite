import { useEffect, useState } from 'react';
import { Search, Settings, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router';
import { Input } from './ui/input';
import { isInTauriLauncher } from '../utils/externalLink';

/**
 * Online/offline mode toggle — only rendered inside the Tauri launcher (it
 * relies on the `isOfflineMode`/`setOfflineMode` bridge functions, which the
 * legacy CEF launcher and the plain web build don't inject).
 *
 * The choice is persisted natively (see GoopieLauncher's offline-mode
 * preference) and survives restarts; toggling navigates the window
 * immediately, so no extra client-side state plumbing is needed.
 */
function OfflineModeToggle() {
  const [offline, setOffline] = useState<boolean | null>(null);

  useEffect(() => {
    const w = window as any;
    if (typeof w.isOfflineMode === 'function') {
      setOffline(Boolean(w.isOfflineMode()));
    }
  }, []);

  if (offline === null) return null;

  const handleClick = () => {
    const w = window as any;
    if (typeof w.setOfflineMode === 'function') {
      w.setOfflineMode(!offline);
      setOffline(!offline);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
      style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
      title={
        offline
          ? 'Enable online mode to download more games and log your progress'
          : 'Switch to offline mode'
      }
    >
      {offline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
    </button>
  );
}

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  audioMuted?: boolean;
  onToggleMute?: () => void;
  isInCEF?: boolean;
}

export function TopBar({ searchQuery, onSearchChange, audioMuted, onToggleMute, isInCEF }: TopBarProps) {
  return (
    <div
      className="sticky top-0 z-30 h-14 md:h-16 border-b flex items-center gap-2 md:gap-4 px-3 md:px-6"
      style={{
        backgroundColor: 'var(--theme-topbar-bg)',
        borderColor: 'var(--theme-border)',
        backdropFilter: 'var(--theme-backdrop-blur)',
        WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
      }}
    >
      {/* Search bar - left aligned */}
      <div className="relative w-full max-w-md">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--theme-text-muted)' }}
        />
        <Input
          type="text"
          placeholder="Search library..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 text-white"
          style={{
            backgroundColor: 'var(--theme-input-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 md:gap-3">
        {isInTauriLauncher() && <OfflineModeToggle />}

        {onToggleMute && (
          <button
            onClick={onToggleMute}
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
            title={audioMuted ? 'Unmute background audio' : 'Mute background audio'}
          >
            {audioMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        )}

        {isInCEF && (
          <Link
            to="/settings"
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
        )}
      </div>
    </div>
  );
}
