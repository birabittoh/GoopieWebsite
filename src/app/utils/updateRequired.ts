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
