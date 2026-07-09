import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Game } from '../types/game';
import type { InstalledBuild } from '../data/useGameReleases';
import { shouldMountUpdate } from '../utils/updateRequired';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

/** Minimal shape needed here from a `required`-status `mods` catalog doc — see `useModCatalog.ts` for the full `CatalogMod`. */
interface RequiredModDoc {
  modId: string;
  assetUrl?: string;
  name: string;
}

/**
 * One-off (non-realtime) fetch of a game's `required` catalog mods, used only
 * at Play time to decide what needs auto-downloading. Deliberately a plain
 * `getDocs` rather than `useModCatalog`'s `onSnapshot` — this hook has no
 * business holding a live subscription open just for an occasional Play-time
 * check.
 */
async function fetchRequiredMods(gameId: string): Promise<RequiredModDoc[]> {
  try {
    const q = query(collection(db, 'mods'), where('gameId', '==', gameId), where('status', '==', 'required'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RequiredModDoc).filter(m => m.modId);
  } catch {
    return [];
  }
}

interface UseRunningGameOptions {
  selectedGame: Game | undefined;
  buildCvarArgs: () => string;
  /** Tag -> declared CVarType, mirroring buildCvarArgs's emitted tags. */
  buildCvarTypes: () => Record<string, string>;
  setAudioMuted: (value: boolean) => void;
  /**
   * Called instead of launching when the selected game's enabled mods fail
   * validation (bad order, missing/conflicting dependency, no binary for
   * this OS, ...) — the Play button itself is never disabled for this; the
   * caller should open the Mods tab so the player can fix or auto-sort it.
   */
  onModsInvalid?: () => void;
}

export function useRunningGame({
  selectedGame,
  buildCvarArgs,
  buildCvarTypes,
  setAudioMuted,
  onModsInvalid,
}: UseRunningGameOptions) {
  const [runningGame, setRunningGame] = useState<{ game: string; build: string } | null>(null);
  const runningGameRef = useRef<{ game: string; build: string } | null>(null);
  const [pendingPlayBuild, setPendingPlayBuild] = useState<InstalledBuild | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  /** Non-null while auto-downloading `required` catalog mods missing on disk, ahead of a Play. */
  const [requiredModsDownload, setRequiredModsDownload] = useState<{ modName: string; progress: number } | null>(null);

  useEffect(() => {
    setLaunchError(null);
    const w = window as any;
    if (typeof w.clearLaunchError === 'function') w.clearLaunchError();
  }, [selectedGame?.id]);

  useEffect(() => {
    const w = window as any;
    if (typeof w.getRunningGame !== 'function') return;
    const poll = () => {
      const running = w.getRunningGame();
      const next = running
        ? { game: String(running.game), build: String(running.build) }
        : null;

      runningGameRef.current = next;
      setRunningGame(prevState => {
        if (prevState?.game === next?.game && prevState?.build === next?.build) return prevState;
        return next;
      });

      if (typeof w.getLaunchError === 'function') {
        const err = w.getLaunchError();
        if (err) setLaunchError(String(err));
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  /** Assemble the full cvar args string (base cvars + XBLA + Xenos flags). */
  const composeCvarArgs = useCallback((): string => {
    if (!selectedGame) return '';
    let cvarArgs = buildCvarArgs();
    if (selectedGame.isXBLA) {
      const prefix = '--license_mask=1';
      cvarArgs = cvarArgs ? `${prefix} ${cvarArgs}` : prefix;
    }
    if (selectedGame.useXenosRenderer) {
      const flag = '--gpu_plugin xenos';
      cvarArgs = cvarArgs ? `${flag} ${cvarArgs}` : flag;
    }
    return cvarArgs;
  }, [selectedGame, buildCvarArgs]);

  /**
   * Mirrors composeCvarArgs's tag set with each tag's declared type, so the
   * launcher can write correctly-typed values (quoted strings vs. bare
   * bool/int/float) into the game's TOML config instead of guessing.
   */
  const composeCvarTypes = useCallback((): Record<string, string> => {
    if (!selectedGame) return {};
    const types = buildCvarTypes();
    if (selectedGame.isXBLA) types.license_mask = 'Int';
    if (selectedGame.useXenosRenderer) types.gpu_plugin = 'Enum';
    return types;
  }, [selectedGame, buildCvarTypes]);

  const playBuild = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    const w = window as any;
    if (typeof w.Play !== 'function') return;
    setAudioMuted(true);
    setLaunchError(null);
    if (typeof w.clearLaunchError === 'function') w.clearLaunchError();
    const cvarArgs = composeCvarArgs();
    const cvarTypes = composeCvarTypes();
    w.Play(selectedGame.recompName, build.name, cvarArgs, undefined, selectedGame.setGameDataRootToAssets === true, shouldMountUpdate(selectedGame, build.asset || build.name), JSON.stringify(cvarTypes));
  }, [selectedGame, composeCvarArgs, composeCvarTypes, setAudioMuted]);

  const continueToPlay = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    if (runningGame && (runningGame.game !== selectedGame.recompName || runningGame.build !== build.name)) {
      setPendingPlayBuild(build);
      return;
    }
    playBuild(build);
  }, [selectedGame, runningGame, playBuild]);

  /**
   * Downloads every `required` catalog mod not yet present in `getMods()`,
   * sequentially, showing progress via `requiredModsDownload`. Returns false
   * (and leaves `launchError` set) if any install fails, so the caller aborts
   * the launch instead of proceeding with an incomplete mod set.
   */
  const installMissingRequiredMods = useCallback(async (game: Game): Promise<boolean> => {
    const w = window as any;
    if (typeof w.getMods !== 'function' || typeof w.installModFromUrl !== 'function') return true;

    const required = await fetchRequiredMods(game.id);
    if (required.length === 0) return true;

    const installed: { id: string }[] = w.getMods(game.recompName) ?? [];
    const installedIds = new Set(installed.map(m => m.id));
    const missing = required.filter(m => !installedIds.has(m.modId) && m.assetUrl);
    if (missing.length === 0) return true;

    for (const mod of missing) {
      setRequiredModsDownload({ modName: mod.name, progress: 0 });
      w.installModFromUrl(game.recompName, mod.assetUrl, mod.modId);

      const ok = await new Promise<boolean>((resolve) => {
        const interval = setInterval(() => {
          if (typeof w.getDownloadProgress === 'function') {
            setRequiredModsDownload({ modName: mod.name, progress: w.getDownloadProgress(game.id) ?? 0 });
          }
          if (w.isInstallingMods && w.isInstallingMods()) return;
          clearInterval(interval);
          const report = w.getModInstallReport ? w.getModInstallReport() : null;
          const results: { ok: boolean }[] = report?.results ?? [];
          resolve(results.length === 0 || results.every(r => r.ok));
        }, 400);
      });

      if (!ok) {
        setRequiredModsDownload(null);
        setLaunchError(`Failed to install required mod "${mod.name}".`);
        return false;
      }
    }

    setRequiredModsDownload(null);
    return true;
  }, []);

  const requestPlay = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;

    // Check mods *before* the "close the running game?" prompt below — no
    // point asking the player to close their current session only to fail
    // to launch the new one afterward. The bridge would refuse to launch
    // anyway (see the Rust-side gate in launch_and_track), but redirecting to
    // the Mods tab here is far more actionable than a plain error banner.
    // `getModValidation` only exists on 1.6.1+ launchers, so the `typeof`
    // check alone is enough to no-op on older ones — no separate version
    // check needed.
    if (selectedGame.modsEnabled) {
      const w = window as any;
      if (typeof w.getModValidation === 'function') {
        const validation = w.getModValidation(selectedGame.recompName);
        if (validation && validation.ok === false) {
          onModsInvalid?.();
          return;
        }
      }
    }

    if (selectedGame.modsEnabled && isLauncherVersionAtLeast('1.7.0')) {
      const game = selectedGame;
      installMissingRequiredMods(game).then(ok => {
        if (ok) continueToPlay(build);
      });
      return;
    }

    continueToPlay(build);
  }, [selectedGame, continueToPlay, onModsInvalid, installMissingRequiredMods]);

  const closeRunningGame = useCallback(() => {
    const w = window as any;
    if (typeof w.closeGame === 'function') w.closeGame();
  }, []);

  const confirmCloseAndPlay = useCallback(() => {
    const build = pendingPlayBuild;
    setPendingPlayBuild(null);
    if (!build) return;
    closeRunningGame();
    playBuild(build);
  }, [pendingPlayBuild, closeRunningGame, playBuild]);

  const runningBuildForSelectedGame = (selectedGame && runningGame && runningGame.game === selectedGame.recompName)
    ? runningGame.build
    : null;

  const isSelectedBuildRunning = useCallback((selectedBuild: InstalledBuild | null | undefined) => {
    return !!(selectedBuild && runningBuildForSelectedGame === selectedBuild.name);
  }, [runningBuildForSelectedGame]);

  return {
    runningGame,
    pendingPlayBuild,
    setPendingPlayBuild,
    launchError,
    setLaunchError,
    requiredModsDownload,
    runningBuildForSelectedGame,
    isSelectedBuildRunning,
    requestPlay,
    closeRunningGame,
    confirmCloseAndPlay,
  };
}
