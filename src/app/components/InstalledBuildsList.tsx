import { useState } from 'react';
import { Play, Trash2, X, ChevronDown, FileText } from 'lucide-react';
import { Button } from './ui/button';
import type { InstalledBuild } from '../data/useGameReleases';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

export function InstalledBuildsList({
  builds,
  recompName,
  onPlay,
  onClose,
  onRemove,
  runningBuild,
  compact,
}: {
  builds: InstalledBuild[];
  recompName: string;
  onPlay: (build: InstalledBuild) => void;
  onClose: (build: InstalledBuild) => void;
  onRemove: (build: InstalledBuild) => void;
  runningBuild?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (builds.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        className={`flex items-center gap-1 font-semibold uppercase tracking-wide ${compact ? 'text-[10px]' : 'text-xs'}`}
        style={{ color: 'var(--theme-text-muted)' }}
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown className={`transition-transform ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${open ? '' : '-rotate-90'}`} />
        Installed builds ({builds.length})
      </button>
      {open && builds.map(build => {
        const isRunning = !!runningBuild && build.name === runningBuild;
        return (
        <div
          key={build.name}
          className={`flex items-center justify-between gap-2 rounded-md ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
          style={{ backgroundColor: 'var(--theme-page-bg)' }}
        >
          <span className={`truncate ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: 'var(--theme-text-primary)' }}>
            {build.version || build.name}
            {build.asset ? ` · ${build.asset}` : ''}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {isRunning ? (
              <Button
                variant="ghost"
                size="icon"
                className="hover:opacity-80"
                style={{ color: '#a52525' }}
                title="Close this build"
                onClick={() => onClose(build)}
              >
                <X className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="hover:opacity-80"
                style={{ color: 'var(--theme-text-secondary)' }}
                title="Play this build"
                onClick={() => onPlay(build)}
              >
                <Play className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </Button>
            )}
            {isLauncherVersionAtLeast('1.4.0') && (
              <Button
                variant="ghost"
                size="icon"
                className="hover:opacity-80"
                style={{ color: 'var(--theme-text-secondary)' }}
                title="Open logs folder"
                onClick={() => (window as any).openBuildLogsFolder(recompName, build.name)}
              >
                <FileText className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hover:opacity-80 disabled:opacity-30 disabled:pointer-events-none"
              style={{ color: 'var(--theme-text-secondary)' }}
              title={isRunning ? 'Close the build before removing it' : 'Remove this build'}
              disabled={isRunning}
              onClick={() => onRemove(build)}
            >
              <Trash2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </Button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
