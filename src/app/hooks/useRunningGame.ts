import { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from '../types/game';
import type { InstalledBuild } from '../data/useGameReleases';
import { shouldMountUpdate } from '../utils/updateRequired';

interface UseRunningGameOptions {
  games: Game[];
  selectedGame: Game | undefined;
  recordSession: (gameId: string, seconds: number) => Promise<void>;
  buildCvarArgs: () => string;
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
  games,
  selectedGame,
  recordSession,
  buildCvarArgs,
  setAudioMuted,
  onModsInvalid,
}: UseRunningGameOptions) {
  const [runningGame, setRunningGame] = useState<{ game: string; build: string } | null>(null);
  const runningGameRef = useRef<{ game: string; build: string; secondsPlayed: number } | null>(null);
  const [pendingPlayBuild, setPendingPlayBuild] = useState<InstalledBuild | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

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
      const prev = runningGameRef.current;
      const next = running
        ? { game: String(running.game), build: String(running.build), secondsPlayed: Number(running.secondsPlayed) || 0 }
        : null;

      if (prev && (prev.game !== next?.game || prev.build !== next?.build)) {
        const finishedGame = games.find(g => g.recompName === prev.game);
        if (finishedGame) void recordSession(finishedGame.id, prev.secondsPlayed);
      }

      runningGameRef.current = next;
      setRunningGame(prevState => {
        if (prevState?.game === next?.game && prevState?.build === next?.build) return prevState;
        return next ? { game: next.game, build: next.build } : null;
      });

      if (typeof w.getLaunchError === 'function') {
        const err = w.getLaunchError();
        if (err) setLaunchError(String(err));
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [games, recordSession]);

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

  const playBuild = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    const w = window as any;
    if (typeof w.Play !== 'function') return;
    setAudioMuted(true);
    setLaunchError(null);
    if (typeof w.clearLaunchError === 'function') w.clearLaunchError();
    const cvarArgs = composeCvarArgs();
    w.Play(selectedGame.recompName, build.name, cvarArgs, undefined, selectedGame.setGameDataRootToAssets === true, shouldMountUpdate(selectedGame, build.asset || build.name));
  }, [selectedGame, composeCvarArgs, setAudioMuted]);

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

    if (runningGame && (runningGame.game !== selectedGame.recompName || runningGame.build !== build.name)) {
      setPendingPlayBuild(build);
      return;
    }
    playBuild(build);
  }, [selectedGame, runningGame, playBuild, onModsInvalid]);

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
    runningBuildForSelectedGame,
    isSelectedBuildRunning,
    requestPlay,
    closeRunningGame,
    confirmCloseAndPlay,
  };
}
