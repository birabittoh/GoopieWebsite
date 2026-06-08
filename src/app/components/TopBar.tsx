import { Search, Settings, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router';
import { Input } from './ui/input';
import { isInTauriLauncher } from '../utils/externalLink';

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

        {(isInCEF || isInTauriLauncher()) && (
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
