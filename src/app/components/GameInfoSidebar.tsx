import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import type { Game } from '../types/game';
import { useGameDevelopers } from '../data/useGameDevelopers';

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
  isInCEF,
  getCvarValue,
  setCvarValue,
  resetCvar,
}: {
  game: Game;
  isInCEF: boolean;
  getCvarValue: (cv: NonNullable<Game['cvars']>[number]) => any;
  setCvarValue: (id: string, value: any) => void;
  resetCvar: (id: string) => void;
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
          {game.xexSha256 && (
            <div>
              <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>XEX SHA256</div>
              <div
                className="font-mono text-xs break-all select-all"
                style={{ color: 'var(--theme-text-primary)' }}
                title={game.xexSha256}
              >
                {game.xexSha256}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings (CVars) */}
      {game.cvars && game.cvars.length > 0 && (
        <div className="p-6 rounded" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Settings</h3>
            {!isInCEF && (
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-muted)' }}>
                launcher only
              </span>
            )}
          </div>
          <div className="space-y-4">
            {game.cvars.map(cv => {
              const value = getCvarValue(cv);
              return (
                <div key={cv.id} style={{ opacity: isInCEF ? 1 : 0.7 }}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <label className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }} htmlFor={`cvar-${cv.id}`}>
                      {cv.displayName || cv.tag}
                    </label>
                    {cv.type === 'Bool' ? (
                      <label className={`relative inline-flex items-center ${isInCEF ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <input
                          id={`cvar-${cv.id}`}
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={e => setCvarValue(cv.id, e.target.checked)}
                          disabled={!isInCEF}
                          className="sr-only peer"
                        />
                        <div
                          className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                          style={{ backgroundColor: value ? 'var(--theme-accent)' : 'var(--theme-item-selected)' }}
                        />
                      </label>
                    ) : (
                      <input
                        id={`cvar-${cv.id}`}
                        type="number"
                        step={cv.type === 'Float' ? 'any' : 1}
                        value={Number(value)}
                        onChange={e => {
                          const n = e.target.value === '' ? 0 : Number(e.target.value);
                          if (!isFinite(n)) return;
                          setCvarValue(cv.id, cv.type === 'Int' ? Math.trunc(n) : n);
                        }}
                        disabled={!isInCEF}
                        className="w-32 rounded-md px-2 py-1 text-sm border outline-none text-right disabled:cursor-not-allowed"
                        style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                      />
                    )}
                  </div>
                  {cv.description && (
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{cv.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
                      -{cv.tag} <span className="opacity-60">({cv.type})</span>
                    </span>
                    {isInCEF && (
                      <button
                        type="button"
                        onClick={() => resetCvar(cv.id)}
                        className="text-[10px] underline"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
