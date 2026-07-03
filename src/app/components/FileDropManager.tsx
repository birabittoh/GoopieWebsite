import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useGameStore } from '../data/GameStore';
import { useFocusedGame } from '../data/FocusedGameContext';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';
import { DropResultDialog, type DropReport, type DropItem } from './DropResultDialog';

/** Trimmed catalogue entry sent to the backend — mirrors `extract::drop::CatalogueEntry`. */
interface CatalogueEntry {
  recompName: string;
  title: string;
  xexSha256: string;
  updateChecksum: string;
  updateStatus: string;
  dlcNames: string[];
}

/**
 * Global drag-and-drop handler, mounted once above the router (see App.tsx)
 * so a file can be dropped on *any* screen — homepage, library, a specific
 * game's page, settings, etc. — not just while the Manage modal is open.
 *
 * Only active on launcher builds new enough to have `ProcessDrops` (1.6.0+);
 * on older launchers this is a no-op and `GameManageModal` keeps handling
 * `goopie:filedrop` itself exactly like before.
 */
export function FileDropManager() {
  const { games } = useGameStore();
  const { focusedGame } = useFocusedGame();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState<DropReport | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusedGameRef = useRef(focusedGame);
  focusedGameRef.current = focusedGame;
  const gamesRef = useRef(games);
  gamesRef.current = games;

  const supported = isLauncherVersionAtLeast('1.6.0') && typeof (window as any).ProcessDrops === 'function';

  const handleDrop = useCallback((paths: string[]) => {
    const w = window as any;
    if (!paths.length) return;

    setDragging(false);

    // If the focused screen is showing a mods-enabled game, route dropped
    // .zip files to the mods installer instead of the game-catalogue matcher
    // below (which only understands base game / update / DLC packages).
    const focused = focusedGameRef.current || '';
    const focusedGame = focused ? gamesRef.current.find(g => g.recompName === focused) : undefined;
    const modsSupported = typeof w.installModArchives === 'function';

    let zips: string[] = [];
    let rest = paths;
    if (focusedGame?.modsEnabled && modsSupported) {
      zips = paths.filter(p => /\.zip$/i.test(p));
      rest = paths.filter(p => !/\.zip$/i.test(p));
    }
    if (!zips.length && !rest.length) return;

    // Both installModArchives and ProcessDrops are fire-and-forget — they run
    // extraction on a background thread and return immediately, so kicking
    // off both here never blocks the webview. We poll isInstallingMods/
    // isExtracting below (mirroring how the "Processing..." toast already
    // worked for ProcessDrops) instead of waiting on the calls themselves.
    if (zips.length) {
      // Pass the plain array — `call()` in shim.js already JSON.stringifies
      // the whole args array, so pre-stringifying here would double-encode
      // it (Rust would see a JSON string where it expects an array).
      w.installModArchives(focused, zips);
    }
    if (rest.length) {
      const catalogue: CatalogueEntry[] = gamesRef.current.map(g => ({
        recompName: g.recompName,
        title: g.title,
        xexSha256: g.xexSha256 || '',
        updateChecksum: g.updateChecksum || '',
        updateStatus: g.updateStatus || 'hidden',
        dlcNames: g.dlcNames || [],
      }));
      w.ProcessDrops(rest, focused, JSON.stringify(catalogue));
    }

    setProcessing(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const modsBusy = zips.length > 0 && w.isInstallingMods && w.isInstallingMods();
      const extractBusy = rest.length > 0 && w.isExtracting && w.isExtracting();
      if (modsBusy || extractBusy) return;

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setProcessing(false);

      let modItems: DropItem[] = [];
      if (zips.length && w.getModInstallReport) {
        const modReport = w.getModInstallReport();
        const results: { path: string; ok: boolean; message: string }[] = modReport?.results ?? [];
        modItems = results.map(r => ({
          file: r.path.split(/[\\/]/).pop() || r.path,
          kind: 'mod' as const,
          status: r.ok ? 'installed' as const : 'error' as const,
          game: focused,
          gameTitle: focusedGame?.title ?? null,
          message: r.message,
        }));
        window.dispatchEvent(new CustomEvent('goopie:modschanged', { detail: { recompName: focused } }));
      }

      const dropResult = rest.length && w.getDropReport ? w.getDropReport() : null;
      if (dropResult) {
        setReport({ items: [...modItems, ...dropResult.items], focusGame: dropResult.focusGame });
        if (dropResult.focusGame) {
          window.location.hash = '#/library/' + encodeURIComponent(dropResult.focusGame);
        }
      } else if (modItems.length) {
        setReport({ items: modItems, focusGame: null });
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (!supported) return;

    const onDragEnter = () => setDragging(true);
    const onDragLeave = () => setDragging(false);
    const onFileDrop = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.paths) handleDrop(detail.paths);
    };

    window.addEventListener('goopie:dragenter', onDragEnter);
    window.addEventListener('goopie:dragleave', onDragLeave);
    window.addEventListener('goopie:filedrop', onFileDrop);
    return () => {
      window.removeEventListener('goopie:dragenter', onDragEnter);
      window.removeEventListener('goopie:dragleave', onDragLeave);
      window.removeEventListener('goopie:filedrop', onFileDrop);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [supported, handleDrop]);

  if (!supported) return null;

  return (
    <>
      {dragging && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        >
          <Upload className="w-12 h-12" style={{ color: 'var(--theme-accent)' }} />
          <p className="text-lg font-semibold text-white">Drop files to install</p>
          <p className="text-sm text-white/70">Games, title updates, and DLC are detected automatically</p>
        </div>
      )}

      {processing && !dragging && (
        <div
          className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg"
          style={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-primary)' }}
        >
          <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }} />
          <span className="text-sm">Processing dropped files...</span>
        </div>
      )}

      <DropResultDialog report={report} onClose={() => setReport(null)} />
    </>
  );
}
