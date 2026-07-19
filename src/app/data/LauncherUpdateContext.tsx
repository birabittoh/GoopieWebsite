import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { isInTauriLauncher } from '../utils/externalLink';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

/**
 * App-wide launcher self-update state, surfaced as the "update available" icon
 * in the TopBar (see TopBar.tsx) and its confirmation dialog.
 *
 * Only meaningful inside the Tauri launcher: the legacy CEF launcher and plain
 * web never inject `CheckForLauncherUpdate`/`SelfUpdateLauncher`, so this
 * provider simply stays idle for them (`isInTauriLauncher()` gates everything).
 *
 * The native side (`launcher::spawn_update_monitor`) checks for a new release
 * roughly every hour — throttled *across restarts* via a persisted last-check
 * timestamp, so relaunching the app repeatedly doesn't burst requests — caching
 * the result so `CheckForLauncherUpdate` is a cheap synchronous read we can
 * poll from here without ever blocking the UI thread (the same concern that
 * `isOfflineMode` had to be fixed for).
 * Nothing here ever applies an update on its own: that only happens when the
 * user explicitly confirms in the dialog.
 */
interface LauncherUpdateContextType {
  /** True once the native side has found a release newer than ours. */
  updateAvailable: boolean;
  /** Raw latest release tag (e.g. "v1.2.0"), or null if unknown. */
  latestVersion: string | null;
  /** True when `window.SelfUpdateLauncher` is available (always true in the Tauri launcher). */
  canSelfUpdate: boolean;
  /** True while a self-update download/apply is in progress. */
  updating: boolean;
  /** 0-100, or -1 when idle (mirrors the native `download_progress`). */
  downloadProgress: number;
  /** Human-readable progress string ("X MB / Y MB"). */
  downloadString: string;
  /** Kick off the download & apply. The launcher restarts itself when done. */
  startSelfUpdate: () => void;
  /** True when the running launcher supports an on-demand update recheck
   *  (`window.RecheckLauncherUpdate`, launcher 1.7.2+). */
  canRecheck: boolean;
  /** True while an on-demand recheck is in flight. */
  checking: boolean;
  /** Timestamp (ms) of the last completed on-demand recheck, or null if none
   *  has run this session — lets the UI show a "checked just now / up to date"
   *  result after the user clicks "Check for updates". */
  lastCheckedAt: number | null;
  /** Force an immediate, off-schedule launcher-update check. No-op (and leaves
   *  `checking` false) on launchers that don't support it. */
  recheck: () => void;
}

const LauncherUpdateContext = createContext<LauncherUpdateContextType | null>(null);

// How often to re-poll the (cheap, cached) native check from the page. The
// native monitor itself only refreshes roughly hourly — this just makes sure
// the icon shows up soon after that without needing a page reload.
const CHECK_POLL_MS = 60_000;
const PROGRESS_POLL_MS = 500;

export function LauncherUpdateProvider({ children }: { children: ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [canSelfUpdate, setCanSelfUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(-1);
  const [downloadString, setDownloadString] = useState('');
  const [canRecheck, setCanRecheck] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const progressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recheckPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the cached native update check. Cheap: it's just an AtomicBool/Mutex
  // read on the Rust side, refreshed in the background roughly every hour.
  useEffect(() => {
    if (!isInTauriLauncher()) return;
    const w = window as any;
    if (typeof w.CheckForLauncherUpdate !== 'function') return;

    setCanSelfUpdate(typeof w.SelfUpdateLauncher === 'function');
    setCanRecheck(
      isLauncherVersionAtLeast('1.7.2') &&
      typeof w.RecheckLauncherUpdate === 'function' &&
      typeof w.isCheckingLauncherUpdate === 'function',
    );

    const check = () => {
      const info = w.CheckForLauncherUpdate();
      if (info?.hasUpdate) {
        setUpdateAvailable(true);
        setLatestVersion(info.latestVersion ?? null);
      }
    };
    check();
    const id = setInterval(check, CHECK_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // While updating, poll download progress — same pattern as the game-update
  // progress polling in Library.tsx.
  useEffect(() => {
    if (!updating) {
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
      return;
    }
    const w = window as any;
    // `getLauncherUpdateProgress`/`-String` (1.6.1+) track the self-update
    // download separately from a game's own download progress. Older
    // launchers only have the shared `getDownloadProgress`/`-String`, which
    // also drives the game page's "updating" progress bar — falling back to
    // it here is the best an old binary can do until it updates past 1.6.1.
    const useOwnProgress = isLauncherVersionAtLeast('1.6.1') && typeof w.getLauncherUpdateProgress === 'function';
    progressPollRef.current = setInterval(() => {
      if (useOwnProgress) {
        setDownloadProgress(w.getLauncherUpdateProgress());
        setDownloadString(w.getLauncherUpdateProgressString ? w.getLauncherUpdateProgressString() : '');
      } else {
        setDownloadProgress(w.getDownloadProgress ? w.getDownloadProgress() : 0);
        setDownloadString(w.getDownloadString ? w.getDownloadString() : '');
      }
    }, PROGRESS_POLL_MS);
    return () => {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    };
  }, [updating]);

  const startSelfUpdate = () => {
    const w = window as any;
    if (typeof w.SelfUpdateLauncher !== 'function') return;
    w.SelfUpdateLauncher();
    setUpdating(true);
  };

  // Clean up the recheck poll on unmount.
  useEffect(() => () => {
    if (recheckPollRef.current) clearInterval(recheckPollRef.current);
  }, []);

  const recheck = () => {
    const w = window as any;
    if (checking) return;
    if (typeof w.RecheckLauncherUpdate !== 'function' || typeof w.isCheckingLauncherUpdate !== 'function') return;
    setChecking(true);
    w.RecheckLauncherUpdate();
    // Poll until the native check finishes, then read the refreshed cache.
    // Unlike the periodic `check` above (which only ever flips the icon *on*),
    // an explicit recheck applies the verdict in both directions so the user
    // sees an accurate "up to date" result right after clicking.
    if (recheckPollRef.current) clearInterval(recheckPollRef.current);
    recheckPollRef.current = setInterval(() => {
      if (w.isCheckingLauncherUpdate()) return;
      if (recheckPollRef.current) {
        clearInterval(recheckPollRef.current);
        recheckPollRef.current = null;
      }
      const info = w.CheckForLauncherUpdate ? w.CheckForLauncherUpdate() : null;
      if (info) {
        setUpdateAvailable(!!info.hasUpdate);
        setLatestVersion(info.latestVersion ?? null);
      }
      setLastCheckedAt(Date.now());
      setChecking(false);
    }, PROGRESS_POLL_MS);
  };

  return (
    <LauncherUpdateContext.Provider
      value={{
        updateAvailable,
        latestVersion,
        canSelfUpdate,
        updating,
        downloadProgress,
        downloadString,
        startSelfUpdate,
        canRecheck,
        checking,
        lastCheckedAt,
        recheck,
      }}
    >
      {children}
    </LauncherUpdateContext.Provider>
  );
}

export function useLauncherUpdate() {
  const ctx = useContext(LauncherUpdateContext);
  if (!ctx) throw new Error('useLauncherUpdate must be used within LauncherUpdateProvider');
  return ctx;
}
