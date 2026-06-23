import { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from '../types/game';
import { readInstalledBuilds, findInstalledBuild, type InstalledBuild } from '../data/useGameReleases';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

interface UseGameInstallationOptions {
  selectedGame: Game | undefined;
  selectedTag: string | undefined;
  selectedAsset: string | undefined;
  isInCEF: boolean;
}

export function useGameInstallation({
  selectedGame,
  selectedTag,
  selectedAsset,
  isInCEF,
}: UseGameInstallationOptions) {
  const [isoInstalled, setIsoInstalled] = useState(false);
  const [exeUpdated, setExeUpdated] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadString, setDownloadString] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractString, setExtractString] = useState('');
  const [extractError, setExtractError] = useState<string | null>(null);
  const [installedBuilds, setInstalledBuilds] = useState<InstalledBuild[]>([]);
  const [updateInstalled, setUpdateInstalled] = useState(false);
  const [dlcInstalled, setDlcInstalled] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const steadyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkState = useCallback(() => {
    const w = window as any;
    if (selectedGame) {
      setIsoInstalled(w.isIsoInstalled ? w.isIsoInstalled(selectedGame.recompName) : false);
      if (isLauncherVersionAtLeast('1.4.0')) {
        if (w.isUpdateInstalled) setUpdateInstalled(w.isUpdateInstalled(selectedGame.recompName));
        if (w.getInstalledDlc) {
          const dlc = w.getInstalledDlc(selectedGame.recompName);
          setDlcInstalled(Array.isArray(dlc) && dlc.length > 0);
        }
      }
      const builds = readInstalledBuilds(selectedGame.recompName);
      setInstalledBuilds(builds);
      const matching = findInstalledBuild(builds, selectedTag, selectedAsset);
      setExeUpdated(matching && w.isExeUpdated ? w.isExeUpdated(selectedGame.recompName, matching.name) : false);
      const isUp = w.isUpdating ? w.isUpdating(selectedGame.id) : false;
      setUpdating(isUp);
      if (isUp) {
        setDownloadProgress(w.getDownloadProgress ? w.getDownloadProgress(selectedGame.id) : 0);
        setDownloadString(w.getDownloadString ? w.getDownloadString(selectedGame.id) : '');
      }
      const isExt = w.isExtracting ? w.isExtracting(selectedGame.id) : false;
      setExtracting(isExt);
      if (isExt) {
        setExtractProgress(w.getExtractProgress ? w.getExtractProgress(selectedGame.id) : 0);
        setExtractString(w.getExtractString ? w.getExtractString(selectedGame.id) : 'Extracting...');
      }
    }
  }, [selectedGame, selectedTag, selectedAsset]);

  useEffect(() => {
    checkState();
  }, [checkState]);

  useEffect(() => {
    if (updating || extracting) {
      pollRef.current = setInterval(() => {
        const w = window as any;
        if (selectedGame) {
          const isUp = w.isUpdating ? w.isUpdating(selectedGame.id) : false;
          setUpdating(isUp);
          if (isUp) {
            setDownloadProgress(w.getDownloadProgress ? w.getDownloadProgress(selectedGame.id) : 0);
            setDownloadString(w.getDownloadString ? w.getDownloadString(selectedGame.id) : '');
          } else {
            const builds = readInstalledBuilds(selectedGame.recompName);
            setInstalledBuilds(builds);
            const matching = findInstalledBuild(builds, selectedTag, selectedAsset);
            setExeUpdated(matching && w.isExeUpdated ? w.isExeUpdated(selectedGame.recompName, matching.name) : false);
          }
          const isExt = w.isExtracting ? w.isExtracting(selectedGame.id) : false;
          setExtracting(isExt);
          if (isExt) {
            setExtractProgress(w.getExtractProgress ? w.getExtractProgress(selectedGame.id) : 0);
            setExtractString(w.getExtractString ? w.getExtractString(selectedGame.id) : 'Extracting...');
          } else {
            setIsoInstalled(w.isIsoInstalled ? w.isIsoInstalled(selectedGame.recompName) : false);
            if (isLauncherVersionAtLeast('1.3.1')) {
              const err = w.getExtractError ? w.getExtractError() : null;
              if (err) setExtractError(err);
            }
          }
        }
      }, 500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [updating, extracting, selectedGame, selectedTag, selectedAsset]);

  useEffect(() => {
    if (steadyPollRef.current) clearInterval(steadyPollRef.current);
    if (!isInCEF || !selectedGame) return;
    steadyPollRef.current = setInterval(() => {
      if (!updating && !extracting) checkState();
    }, 1500);
    return () => {
      if (steadyPollRef.current) clearInterval(steadyPollRef.current);
    };
  }, [isInCEF, selectedGame, updating, extracting, checkState]);

  useEffect(() => {
    if (!isInCEF) return;
    const onFocus = () => checkState();
    const onVisible = () => { if (document.visibilityState === 'visible') checkState(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isInCEF, checkState]);

  const handleInstallIso = useCallback(() => {
    if (!selectedGame) return;
    (window as any).Install(selectedGame.recompName);
    setExtracting(true);
    setExtractProgress(0);
    setExtractString('');
  }, [selectedGame]);

  const setUpdatingState = useCallback((value: boolean) => {
    setUpdating(value);
    if (value) {
      setDownloadProgress(0);
      setDownloadString('');
    }
  }, []);

  const clearExtractError = useCallback(() => {
    setExtractError(null);
    const w = window as any;
    if (isLauncherVersionAtLeast('1.3.1') && w.clearExtractError) {
      w.clearExtractError();
    }
  }, []);

  return {
    isoInstalled,
    exeUpdated,
    updating,
    downloadProgress,
    downloadString,
    extracting,
    extractProgress,
    extractString,
    extractError,
    clearExtractError,
    installedBuilds,
    updateInstalled,
    dlcInstalled,
    checkState,
    handleInstallIso,
    setUpdating: setUpdatingState,
  };
}
