import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

interface LeaderboardColumn {
  id: number;
  type: string;
  value: number | string | null;
}

interface LeaderboardRow {
  xuid: string;
  gamertag: string;
  columns: LeaderboardColumn[];
}

interface LeaderboardBoard {
  titleId: string;
  viewId: number;
  rows: LeaderboardRow[];
}

/** Windows FILETIME (100-ns intervals since 1601-01-01 UTC) → ms since Unix epoch. */
const FILETIME_EPOCH_DIFF_MS = 11644473600000;

function formatDuration(absMs: number): string {
  const totalSeconds = Math.floor(absMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Formats a leaderboard column's value.
 *
 * The X_USER_DATA `type` tag only describes the wire representation
 * (int32/int64/double/…), not what the value *means* — games routinely stash
 * a millisecond duration (e.g. a lap time) in a plain `Int64` column, so the
 * type alone can't be trusted to tell a duration from a real score. Instead
 * we guess from the value itself: a huge magnitude (~1.3e17 for present-day
 * dates) is a real Windows FILETIME and renders as a calendar date/time; a
 * negative number is treated as a millisecond duration — this game's
 * convention for elapsed time — and renders as HH:MM:SS. Non-negative
 * numbers (typical scores/counts) are left as plain numbers.
 */
function formatColumnValue(column: LeaderboardColumn): string {
  const { type, value } = column;
  if (value === null || value === undefined) return '—';
  if (type === 'WString' || typeof value !== 'number') return String(value);

  const FILETIME_THRESHOLD = 1e13;
  if (Math.abs(value) > FILETIME_THRESHOLD) {
    const ms = value / 10000 - FILETIME_EPOCH_DIFF_MS;
    const date = new Date(ms);
    return isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  if (value < 0) return formatDuration(Math.abs(value));

  if (type === 'Double' || type === 'Float') return value.toFixed(3);

  return String(value);
}

interface LeaderboardsPanelProps {
  recompName: string;
}

export function LeaderboardsPanel({ recompName }: LeaderboardsPanelProps) {
  const [files, setFiles] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [boards, setBoards] = useState<LeaderboardBoard[] | null>(null);

  useEffect(() => {
    const w = window as any;
    if (typeof w.listLeaderboardFiles !== 'function') return;
    const result = w.listLeaderboardFiles(recompName);
    const list: string[] = Array.isArray(result) ? result : [];
    setFiles(list);
    setSelected(new Set(list));
  }, [recompName]);

  useEffect(() => {
    if (!files || selected.size === 0) {
      setBoards([]);
      return;
    }
    const w = window as any;
    if (typeof w.getLeaderboards !== 'function') return;
    const result = w.getLeaderboards(recompName, Array.from(selected));
    setBoards(Array.isArray(result) ? result : []);
  }, [recompName, files, selected]);

  const toggleFile = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (files === null) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
        Loading leaderboards…
      </p>
    );
  }

  if (files.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
        No leaderboard data found for this game.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {files.length > 1 && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
          {files.map(id => {
            const isSelected = selected.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleFile(id)}
                className="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-item-selected)',
                  borderColor: 'var(--theme-border)',
                  color: isSelected ? '#fff' : 'var(--theme-text-muted)',
                }}
              >
                {id}
              </button>
            );
          })}
        </div>
      )}

      {boards === null ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
          Loading leaderboards…
        </p>
      ) : boards.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
          {selected.size === 0 ? 'Select a file above to view its leaderboards.' : 'No boards found in the selected file(s).'}
        </p>
      ) : (
        <div className="space-y-4">
          {boards.map((board, bi) => (
            <div key={`${board.titleId}-${board.viewId}-${bi}`} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 shrink-0" style={{ color: '#f5c518' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                  View {board.viewId}
                </p>
                <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  ({board.titleId})
                </span>
              </div>

              {board.rows.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>No rows submitted yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--theme-text-muted)' }}>
                        <th className="text-left font-medium py-1 pr-3">#</th>
                        <th className="text-left font-medium py-1 pr-3">Gamertag</th>
                        <th className="text-left font-medium py-1">Columns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.rows.map((row, ri) => (
                        <tr key={row.xuid || ri} className="border-t" style={{ borderColor: 'var(--theme-border)' }}>
                          <td className="py-1.5 pr-3" style={{ color: 'var(--theme-text-muted)' }}>{ri + 1}</td>
                          <td className="py-1.5 pr-3 font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            {row.gamertag || row.xuid || 'Unknown'}
                          </td>
                          <td className="py-1.5" style={{ color: 'var(--theme-text-primary)' }}>
                            {row.columns.length === 0
                              ? '—'
                              : row.columns
                                  .map(c => `#${c.id}: ${formatColumnValue(c)}`)
                                  .join('  ·  ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
