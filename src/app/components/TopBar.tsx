import { useState } from 'react';
import { Search, Settings, DownloadCloud, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router';
import { Input } from './ui/input';
import { isInTauriLauncher, openExternal } from '../utils/externalLink';
import { useLauncherUpdate } from '../data/LauncherUpdateContext';
import { LauncherUpdateDialog } from './LauncherUpdateDialog';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  audioMuted?: boolean;
  onToggleMute?: () => void;
  isInCEF?: boolean;
}

export function TopBar({ searchQuery, onSearchChange, audioMuted, onToggleMute, isInCEF }: TopBarProps) {
  const { updateAvailable, latestVersion } = useLauncherUpdate();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

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
        <a
          href="https://discord.gg/vq4GcEs46M"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (isInTauriLauncher()) { e.preventDefault(); openExternal('https://discord.gg/vq4GcEs46M'); } }}
          className="hidden sm:inline-flex items-center gap-2 px-3 h-9 rounded-full bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-semibold transition-colors"
          title="Join the Goopie support Discord"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Support
        </a>

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

        {updateAvailable && (
          <button
            onClick={() => setUpdateDialogOpen(true)}
            className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
            title={latestVersion ? `Launcher update available (${latestVersion})` : 'Launcher update available'}
          >
            <DownloadCloud className="w-5 h-5" />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-update-glow"
              style={{ backgroundColor: 'var(--theme-accent)' }}
              aria-hidden="true"
            />
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

      <LauncherUpdateDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} />
    </div>
  );
}
