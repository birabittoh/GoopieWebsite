import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import type { Game } from '../types/game';
import { useGameDevelopers } from '../data/useGameDevelopers';
import type { GamePlaytime } from '../data/usePlaytime';

/** Formats whole seconds as a compact human-readable duration, e.g. "3h 5m". */
function formatPlaytime(seconds: number): string {
  if (seconds < 60) return '< 1m';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function formatLastPlayed(date: Date): string {
  return date.toLocaleDateString();
}

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

export function GameInfoSidebar({
  game,
  playtime,
}: {
  game: Game;
  playtime?: GamePlaytime | null;
}) {
  const assignedDevs = useGameDevelopers(game.id);

  return (
    <div className="space-y-6">
      {/* Game Info */}
      <div className="p-6 rounded" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--theme-text-primary)' }}>Game Info</h3>
        <div className="space-y-4">
          <div>
            <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Original Developer</div>
            <div style={{ color: 'var(--theme-text-primary)' }}>{game.og_developer}</div>
          </div>
          <div>
            <div className="text-sm mb-2" style={{ color: 'var(--theme-text-muted)' }}>Recompiled By</div>
            <div className="space-y-2">
              {/* Linked user accounts — shown with avatar */}
              {assignedDevs.map(dev => (
                <div key={dev.uid} className="flex items-center gap-2">
                  {dev.picture ? (
                    <img
                      src={dev.picture}
                      alt={dev.username}
                      className="w-6 h-6 rounded-full shrink-0 object-cover"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--theme-item-selected)' }}
                    >
                      {dev.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>{dev.username}</span>
                </div>
              ))}
              {/* Manually entered names */}
              {game.recompiled_developers.length > 0 && (
                <div className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                  {game.recompiled_developers.join(', ')}
                </div>
              )}
              {assignedDevs.length === 0 && game.recompiled_developers.length === 0 && (
                <div className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>—</div>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Status</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusColors[game.status]} cursor-default`}>
                  {game.status}
                </span>
              </TooltipTrigger>
              <TooltipContent>{statusDescriptions[game.status]}</TooltipContent>
            </Tooltip>
          </div>
          {game.xexVersion && (
            <div>
              <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>XEX Version</div>
              <div style={{ color: 'var(--theme-text-primary)' }}>{game.xexVersion}</div>
            </div>
          )}
          {playtime && playtime.totalSeconds > 0 && (
            <div>
              <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Total Playtime</div>
              <div style={{ color: 'var(--theme-text-primary)' }}>{formatPlaytime(playtime.totalSeconds)}</div>
            </div>
          )}
          {playtime && playtime.totalSeconds > 0 && playtime.lastPlayedAt && (
            <div>
              <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Last Played</div>
              <div style={{ color: 'var(--theme-text-primary)' }}>{formatLastPlayed(playtime.lastPlayedAt)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
