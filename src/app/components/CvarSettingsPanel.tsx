import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Game } from '../types/game';

export function CvarSettingsPanel({
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
  return (
    <div>
      {!isInCEF && (
        <div className="flex justify-end mb-4">
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-muted)' }}>
            launcher only
          </span>
        </div>
      )}
      <div className="space-y-4">
        {(game.cvars ?? []).map(cv => {
          const value = getCvarValue(cv);
          return (
            <div key={cv.id} style={{ opacity: isInCEF ? 1 : 0.7 }}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <label className="text-sm font-medium min-w-0 truncate" style={{ color: 'var(--theme-text-primary)' }} htmlFor={`cvar-${cv.id}`}>
                  {cv.displayName || cv.tag}
                </label>
                <div className="shrink-0">
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
                ) : cv.type === 'Enum' ? (
                  <Select
                    value={String(value)}
                    onValueChange={v => setCvarValue(cv.id, v)}
                    disabled={!isInCEF}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-auto min-w-32 rounded border text-sm"
                      style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}>
                      {(cv.options ?? []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : cv.type === 'String' ? (
                  <input
                    id={`cvar-${cv.id}`}
                    type="text"
                    value={String(value)}
                    onChange={e => setCvarValue(cv.id, e.target.value)}
                    disabled={!isInCEF}
                    className="w-32 rounded-md px-2 py-1 text-sm border outline-none text-right disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                  />
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
  );
}
