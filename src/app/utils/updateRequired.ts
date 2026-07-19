import type { Game } from '../types/game';

export function updateRequiredForBuild(game: Game, buildAsset: string | undefined): boolean {
  if (game.updateStatus === 'required') return true;
  if (game.updateStatus === 'optional' && game.updateBuildPattern && buildAsset) {
    const stripped = buildAsset.replace(new RegExp(`^${game.recompName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-?`), '');
    try {
      return new RegExp(game.updateBuildPattern).test(stripped);
    } catch {
      return false;
    }
  }
  return false;
}

export function shouldMountUpdate(game: Game, buildAsset: string | undefined): boolean {
  if (game.updateStatus === 'hidden') return false;
  if (game.updateStatus === 'required') return true;
  if (game.updateStatus === 'optional') {
    if (!game.updateBuildPattern) return true;
    return updateRequiredForBuild(game, buildAsset);
  }
  return true;
}

/**
 * When switching a build's version (either via the version picker or an
 * automatic update to the latest release), prefer an asset in `targetAssets`
 * whose "requires the TU" status matches `currentAsset`'s, so a user on a
 * vanilla build stays on a vanilla build (and a TU build stays on a TU build)
 * across version changes instead of silently landing on whichever asset
 * happens to sort first.
 *
 * `targetAssets` should already be sorted by relevance/preference — the first
 * matching asset is returned. Returns `undefined` when `currentAsset` is
 * unknown or no asset in the target matches its TU status, letting the caller
 * fall back to its normal default-asset selection.
 */
export function pickAssetPreservingTuStatus<T extends { name: string }>(
  game: Game,
  currentAsset: string | undefined,
  targetAssets: T[],
): T | undefined {
  if (!currentAsset) return undefined;
  const wantsTu = updateRequiredForBuild(game, currentAsset);
  return targetAssets.find(a => updateRequiredForBuild(game, a.name) === wantsTu);
}

/**
 * Picks the asset matching the developer-configured `defaultBuildPreference`
 * (vanilla or TU), for auto-selecting a build the first time a user extracts
 * assets for a game (i.e. before they've ever picked/installed a build).
 * Only meaningful when `updateStatus === 'optional'` and `updateBuildPattern`
 * is set — returns `undefined` otherwise, letting the caller fall back to its
 * normal default-asset selection.
 */
export function pickAssetByDefaultBuildPreference<T extends { name: string }>(
  game: Game,
  targetAssets: T[],
): T | undefined {
  if (game.updateStatus !== 'optional' || !game.updateBuildPattern) return undefined;
  const wantsTu = game.defaultBuildPreference === 'tu';
  return targetAssets.find(a => updateRequiredForBuild(game, a.name) === wantsTu);
}
