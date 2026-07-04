export interface GamePlaytime {
  totalSeconds: number;
  lastPlayedAt?: Date;
}

interface BridgePlaytime {
  totalSeconds: number;
  lastPlayedAt: number;
}

/**
 * Reads per-game play-time recorded locally by the launcher (see
 * GoopieLauncher's `src-tauri/src/playtime.rs`) via `window.getPlaytime`.
 *
 * Local/launcher-only, mirroring achievements: there is no cloud sync for
 * play-time, so this only works inside the Tauri launcher and only reflects
 * time played on this machine. Returns `null` everywhere else (plain web,
 * older launchers, or a game that's never been played).
 */
export function usePlaytime() {
  const getPlaytime = (recompName: string): GamePlaytime | null => {
    const w = window as any;
    if (typeof w.getPlaytime !== 'function') return null;
    try {
      const entry: BridgePlaytime | null = w.getPlaytime(recompName);
      if (!entry || !entry.totalSeconds) return null;
      return {
        totalSeconds: entry.totalSeconds,
        lastPlayedAt: entry.lastPlayedAt ? new Date(entry.lastPlayedAt * 1000) : undefined,
      };
    } catch {
      return null;
    }
  };

  return { getPlaytime };
}
