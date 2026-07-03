import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, FolderOpen, Upload, GripVertical, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { ConfirmDialog } from './ConfirmDialog';

interface ModInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  requires: string[];
  enabled: boolean;
  /** `data:image/png;base64,...`, or empty when the mod has no icon.png. */
  icon: string;
}

interface InstallResult {
  path: string;
  ok: boolean;
  message: string;
}

interface ModsPanelProps {
  recompName: string;
}

/**
 * Mods tab content for GameManageModal. Lists installed mods (enabled ones
 * first, in load-priority order, then disabled ones), lets the player
 * reorder (drag), enable/disable, remove, and browse for `.zip` archives to
 * install. Dropping `.zip` files on the window while this game is focused is
 * handled globally by FileDropManager, which dispatches `goopie:modschanged`
 * on completion — this panel listens for that to stay in sync.
 *
 * Dependency enforcement (the `requires` field) is deferred: it's surfaced
 * as informational text only, nothing is blocked yet.
 */
export function ModsPanel({ recompName }: ModsPanelProps) {
  const [mods, setMods] = useState<ModInfo[] | null>(null);
  const [installing, setInstalling] = useState(false);
  const [lastReport, setLastReport] = useState<InstallResult[] | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ModInfo | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);
  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (installPollRef.current) clearInterval(installPollRef.current); }, []);

  const fetchMods = useCallback(() => {
    const w = window as any;
    if (typeof w.getMods !== 'function') return;
    const result = w.getMods(recompName);
    setMods(Array.isArray(result) ? result : []);
  }, [recompName]);

  useEffect(() => {
    fetchMods();
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.recompName || detail.recompName === recompName) fetchMods();
    };
    window.addEventListener('goopie:modschanged', onChanged);
    return () => window.removeEventListener('goopie:modschanged', onChanged);
  }, [fetchMods, recompName]);

  const persist = useCallback((next: ModInfo[]) => {
    setMods(next);
    const w = window as any;
    if (typeof w.setModsState !== 'function') return;
    const entries = next.map(m => ({ id: m.id, enabled: m.enabled }));
    // `call()` in shim.js already JSON.stringifies the whole args array —
    // pass the plain array/object here, not a pre-stringified string, or it
    // double-encodes and the Rust side's serde_json::from_value silently
    // fails (Value::String where a sequence is expected), yielding an empty list.
    w.setModsState(recompName, entries);
  }, [recompName]);

  const toggleEnabled = useCallback((id: string) => {
    if (!mods) return;
    persist(mods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  }, [mods, persist]);

  const findModId = useCallback((el: Element | null): string | null => {
    while (el && el !== listRef.current) {
      if (el instanceof HTMLElement && el.dataset.modId) return el.dataset.modId;
      el = el.parentElement;
    }
    return null;
  }, []);

  const handleReorder = useCallback((fromId: string, toId: string) => {
    if (!mods || fromId === toId) return;
    const fromIndex = mods.findIndex(m => m.id === fromId);
    const toIndex = mods.findIndex(m => m.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = mods.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist(next);
  }, [mods, persist]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (pendingDrag.current) {
        const dx = e.clientX - pendingDrag.current.x;
        const dy = e.clientY - pendingDrag.current.y;
        if (dx * dx + dy * dy > 25) {
          setDragId(pendingDrag.current.id);
          pendingDrag.current = null;
        }
        return;
      }
      if (!dragId) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetId = findModId(target);
      if (targetId && targetId !== dragId) handleReorder(dragId, targetId);
    };
    const onUp = () => {
      pendingDrag.current = null;
      setDragId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragId, findModId, handleReorder]);

  const handleBrowse = useCallback(() => {
    const w = window as any;
    if (typeof w.pickModArchives !== 'function') return;

    // Fire-and-forget: the dialog pick is synchronous (it's a modal the user
    // is actively driving), but extraction afterward runs on a background
    // thread — large mod zips can take several seconds, and blocking here
    // would freeze the whole webview. Poll isInstallingMods instead.
    const started = w.pickModArchives(recompName);
    if (!started) return; // user cancelled the dialog

    setInstalling(true);
    if (installPollRef.current) clearInterval(installPollRef.current);
    installPollRef.current = setInterval(() => {
      if (w.isInstallingMods && w.isInstallingMods()) return;
      if (installPollRef.current) clearInterval(installPollRef.current);
      installPollRef.current = null;
      setInstalling(false);
      const report = w.getModInstallReport ? w.getModInstallReport() : null;
      const results: InstallResult[] = report?.results ?? [];
      if (results.length) setLastReport(results);
      fetchMods();
    }, 400);
  }, [recompName, fetchMods]);

  const handleRemove = useCallback((mod: ModInfo) => {
    const w = window as any;
    if (typeof w.removeMod === 'function') w.removeMod(recompName, mod.id);
    setConfirmRemove(null);
    fetchMods();
  }, [recompName, fetchMods]);

  const handleOpenFolder = useCallback(() => {
    const w = window as any;
    if (typeof w.openModsFolder === 'function') w.openModsFolder(recompName);
  }, [recompName]);

  if (mods === null) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
        Loading mods…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          Drag to reorder load priority (top = highest).
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleOpenFolder} title="Open mods folder">
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleBrowse} disabled={installing}>
            <Upload className="w-3 h-3 mr-1" /> Browse...
          </Button>
        </div>
      </div>

      {installing && (
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--theme-accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>Installing mod(s)...</span>
        </div>
      )}

      {lastReport && (
        <div className="p-3 rounded-lg text-xs space-y-1" style={{ backgroundColor: 'var(--theme-item-default)' }}>
          {lastReport.map((r, i) => (
            <div key={i} className={r.ok ? 'text-green-400' : 'text-red-300'}>
              {r.ok ? r.message : `${r.path.split(/[\\/]/).pop()}: ${r.message}`}
            </div>
          ))}
        </div>
      )}

      {mods.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--theme-text-muted)' }}>
          No mods installed. Browse for a `.zip`, or drop one onto the window.
        </p>
      ) : (
        <div ref={listRef} className="space-y-2">
          {mods.map(mod => {
            const isDragging = dragId === mod.id;
            return (
              <div
                key={mod.id}
                data-mod-id={mod.id}
                className="flex items-center gap-3 p-3 rounded-lg select-none"
                style={{
                  backgroundColor: 'var(--theme-item-default)',
                  opacity: mod.enabled ? (isDragging ? 0.6 : 1) : 0.5,
                }}
              >
                <span
                  className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
                  style={{ color: 'var(--theme-text-muted)' }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    pendingDrag.current = { id: mod.id, x: e.clientX, y: e.clientY };
                  }}
                >
                  <GripVertical className="w-4 h-4" />
                </span>

                <div
                  className="shrink-0 w-9 h-9 flex items-center justify-center overflow-hidden rounded"
                  style={mod.icon ? undefined : { backgroundColor: 'var(--theme-item-selected)' }}
                >
                  {mod.icon ? (
                    <img src={mod.icon} alt="" className="w-9 h-9 object-cover" />
                  ) : (
                    <Package className="w-4 h-4" style={{ color: 'var(--theme-text-muted)' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
                    {mod.name}
                    {mod.version && <span className="font-normal ml-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>v{mod.version}</span>}
                  </p>
                  {(mod.author || mod.description) && (
                    <p className="text-xs break-words" style={{ color: 'var(--theme-text-muted)' }}>
                      {mod.author && <span>{mod.author}</span>}
                      {mod.author && mod.description && <span> — </span>}
                      {mod.description}
                    </p>
                  )}
                  {mod.requires.length > 0 && (
                    <p className="text-xs flex items-center gap-1 mt-0.5 text-yellow-400">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> Requires: {mod.requires.join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--theme-text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={mod.enabled}
                      onChange={() => toggleEnabled(mod.id)}
                    />
                    Enabled
                  </label>
                  <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => setConfirmRemove(mod)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Confirm"
        description={`Remove mod "${confirmRemove?.name ?? ''}"? This deletes its files.`}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && handleRemove(confirmRemove)}
      />
    </div>
  );
}
