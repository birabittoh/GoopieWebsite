import { useEffect, useMemo, useState } from 'react';
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

/** Fallback column names used when a game defines no explicit column mapping. */
const DEFAULT_COLUMN_NAMES: Record<number, string> = { 1: 'Score', 2: 'Time' };

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

/**
 * Ranks a board's rows by its primary column (the lowest numeric column id
 * present, e.g. "Score"). Re-ranking is necessary once rows have been merged
 * from multiple leaderboard store files, since no single file's on-disk row
 * order reflects the combined standings.
 */
function rankRows(rows: LeaderboardRow[], ascending: boolean): LeaderboardRow[] {
  const primaryColumnId = Math.min(
    ...rows.flatMap(row => row.columns.map(c => c.id)).filter(id => Number.isFinite(id)),
  );
  if (!Number.isFinite(primaryColumnId)) return rows;

  return [...rows].sort((a, b) => {
    const av = a.columns.find(c => c.id === primaryColumnId)?.value;
    const bv = b.columns.find(c => c.id === primaryColumnId)?.value;
    if (typeof av !== 'number' && typeof bv !== 'number') return 0;
    if (typeof av !== 'number') return 1;
    if (typeof bv !== 'number') return -1;
    return ascending ? av - bv : bv - av;
  });
}

interface LeaderboardsPanelProps {
  recompName: string;
  viewNames?: Record<string, string>;
  columnNames?: Record<string, Record<string, string>>;
  viewAscending?: Record<string, boolean>;
}

export function LeaderboardsPanel({ recompName, viewNames, columnNames, viewAscending }: LeaderboardsPanelProps) {
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

  // Each selected store file yields its own board per view_id (a game can
  // accumulate multiple store files across title updates, e.g. one written
  // under an old title id and one under a new one). Merge same-view_id
  // boards across all selected files into a single table so scores from
  // every file show up together, instead of one table per file.
  const mergedBoards = useMemo(() => {
    if (!boards) return null;
    const byView = new Map<number, { viewId: number; titleIds: string[]; rows: LeaderboardBoard['rows'] }>();
    for (const board of boards) {
      let entry = byView.get(board.viewId);
      if (!entry) {
        entry = { viewId: board.viewId, titleIds: [], rows: [] };
        byView.set(board.viewId, entry);
      }
      if (!entry.titleIds.includes(board.titleId)) entry.titleIds.push(board.titleId);
      entry.rows.push(...board.rows);
    }
    return Array.from(byView.values())
      .map(entry => ({ ...entry, rows: rankRows(entry.rows, !!viewAscending?.[String(entry.viewId)]) }))
      .sort((a, b) => a.viewId - b.viewId);
  }, [boards, viewAscending]);

  // Store files are named after the hex title id the game itself writes to;
  // anything else is a file a user has renamed/copied in (e.g. to preserve
  // an old store), so only label the untouched hex-named file as "Live".
  const fileLabel = (id: string) => (/^[0-9a-fA-F]{8}$/.test(id) ? `Live (${id})` : id);

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
                {fileLabel(id)}
              </button>
            );
          })}
        </div>
      )}

      {mergedBoards === null ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
          Loading leaderboards…
        </p>
      ) : mergedBoards.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
          {selected.size === 0 ? 'Select a file above to view its leaderboards.' : 'No boards found in the selected file(s).'}
        </p>
      ) : (
        <div className="space-y-4">
          {mergedBoards.map(board => (
            <div key={board.viewId} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 shrink-0" style={{ color: '#f5c518' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                  {viewNames?.[String(board.viewId)] || `View ${board.viewId}`}
                </p>
              </div>

              {board.rows.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>No rows submitted yet.</p>
              ) : (
                (() => {
                  const columnIds = Array.from(new Set(board.rows.flatMap(row => row.columns.map(c => c.id)))).sort((a, b) => a - b);
                  const viewColumnNames = columnNames?.[String(board.viewId)];
                  const columnLabel = (id: number) =>
                    viewColumnNames?.[String(id)] || DEFAULT_COLUMN_NAMES[id] || `Column ${id}`;
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ color: 'var(--theme-text-muted)' }}>
                            <th className="text-left font-medium py-1 pr-3" style={{ width: '2rem' }}>#</th>
                            <th className="text-left font-medium py-1 pr-3" style={{ minWidth: '8rem' }}>Gamertag</th>
                            {columnIds.map(id => (
                              <th key={id} className="text-right font-medium py-1 pr-3" style={{ minWidth: '6rem' }}>{columnLabel(id)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {board.rows.map((row, ri) => (
                            <tr key={row.xuid || ri} className="border-t" style={{ borderColor: 'var(--theme-border)' }}>
                              <td className="py-1.5 pr-3" style={{ color: 'var(--theme-text-muted)' }}>{ri + 1}</td>
                              <td className="py-1.5 pr-3 font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                {row.gamertag || row.xuid || 'Unknown'}
                              </td>
                              {columnIds.map(id => {
                                const column = row.columns.find(c => c.id === id);
                                return (
                                  <td key={id} className="py-1.5 pr-3 text-right tabular-nums" style={{ color: 'var(--theme-text-primary)' }}>
                                    {column ? formatColumnValue(column) : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
