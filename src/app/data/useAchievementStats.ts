import { useMemo } from 'react';
import type { Game } from '../types/game';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

export interface AchievementStats {
  unlocked: number;
  total: number;
  earnedScore: number;
  totalScore: number;
}

interface BridgeSummary {
  unlocked: number;
  total: number;
  earnedScore: number;
  totalScore: number;
}

/**
 * Aggregates gamer cred (achievement score) across all of the user's
 * achievement-enabled, installed games by calling the launcher bridge's
 * `getAchievementSummary` per game and summing the results.
 *
 * Local/launcher-only: there is no Firestore sync for achievement progress,
 * so this only works inside the Tauri launcher (>= 1.5.2) and only reflects
 * games actually installed on this machine. Returns `null` everywhere else
 * (plain web, older launchers) so callers can hide the stat entirely.
 */
export function useAchievementStats(games: Game[]): AchievementStats | null {
  return useMemo(() => {
    const w = window as any;
    if (!isLauncherVersionAtLeast('1.5.2') || typeof w.getAchievementSummary !== 'function') {
      return null;
    }

    const enabledGames = games.filter(g => g.achievementsEnabled);
    if (enabledGames.length === 0) {
      return { unlocked: 0, total: 0, earnedScore: 0, totalScore: 0 };
    }

    const stats: AchievementStats = { unlocked: 0, total: 0, earnedScore: 0, totalScore: 0 };
    for (const game of enabledGames) {
      try {
        const summary: BridgeSummary = w.getAchievementSummary(game.recompName);
        if (!summary) continue;
        stats.unlocked += summary.unlocked || 0;
        stats.total += summary.total || 0;
        stats.earnedScore += summary.earnedScore || 0;
        stats.totalScore += summary.totalScore || 0;
      } catch {
        /* game not installed / no XEX / parse failure — skip it */
      }
    }
    return stats;
  }, [games]);
}
