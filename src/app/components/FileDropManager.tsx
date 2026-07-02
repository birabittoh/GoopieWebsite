import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useGameStore } from '../data/GameStore';
import { useFocusedGame } from '../data/FocusedGameContext';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';
import { DropResultDialog, type DropReport } from './DropResultDialog';

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

    const catalogue: CatalogueEntry[] = gamesRef.current.map(g => ({
      recompName: g.recompName,
      title: g.title,
      xexSha256: g.xexSha256 || '',
      updateChecksum: g.updateChecksum || '',
      updateStatus: g.updateStatus || 'hidden',
      dlcNames: g.dlcNames || [],
    }));

    setDragging(false);
    setProcessing(true);
    w.ProcessDrops(paths, focusedGameRef.current || '', JSON.stringify(catalogue));

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (w.isExtracting && w.isExtracting()) return;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setProcessing(false);
      const result = w.getDropReport ? w.getDropReport() : null;
      if (result) {
        setReport(result);
        if (result.focusGame) {
          window.location.hash = '#/library/' + encodeURIComponent(result.focusGame);
        }
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
