import { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from '../types/game';
import type { InstalledBuild } from '../data/useGameReleases';

interface UseRunningGameOptions {
  games: Game[];
  selectedGame: Game | undefined;
  recordSession: (gameId: string, seconds: number) => Promise<void>;
  buildCvarArgs: () => string;
  setAudioMuted: (value: boolean) => void;
}

export function useRunningGame({
  games,
  selectedGame,
  recordSession,
  buildCvarArgs,
  setAudioMuted,
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

  const playBuild = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    const w = window as any;
    if (typeof w.Play !== 'function') return;
    setAudioMuted(true);
    setLaunchError(null);
    if (typeof w.clearLaunchError === 'function') w.clearLaunchError();
    let cvarArgs = buildCvarArgs();
    if (selectedGame.isXBLA) {
      const prefix = '--license_mask=1';
      cvarArgs = cvarArgs ? `${prefix} ${cvarArgs}` : prefix;
    }
    if (selectedGame.useXenosRenderer) {
      const flag = '--gpu_plugin xenos';
      cvarArgs = cvarArgs ? `${flag} ${cvarArgs}` : flag;
    }
    w.Play(selectedGame.recompName, build.name, cvarArgs, undefined, selectedGame.setGameDataRootToAssets === true);
  }, [selectedGame, buildCvarArgs, setAudioMuted]);

  const requestPlay = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    if (runningGame && (runningGame.game !== selectedGame.recompName || runningGame.build !== build.name)) {
      setPendingPlayBuild(build);
      return;
    }
    playBuild(build);
  }, [selectedGame, runningGame, playBuild]);

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
