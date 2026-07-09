import { useCallback, useEffect, useRef, useState } from 'react';

/** A mod already unpacked on disk, as read from its manifest by the Rust side (`getMods`). */
export interface ModInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  requires: string[];
  conflicts: string[];
  load_after: string[];
  /** Platform target(s) this mod's `code/` ships a binary for (e.g. `["windows-x64", "linux-x64"]`); empty for asset-only mods. */
  platform: string[];
  /** `true` when the mod ships a native DLL/SO (declares a `code` stem). */
  is_code: boolean;
  enabled: boolean;
  /** `data:image/png;base64,...`, or empty when the mod has no icon.png. */
  icon: string;
  /** Minimum host/game version this mod requires (e.g. `"1.2.0"`), or empty if the manifest declares no `game_version`. */
  game_version: string;
}

export interface InstallResult {
  path: string;
  ok: boolean;
  message: string;
}

export interface ModIssue {
  id: string;
  kind: 'error' | 'warning';
  message: string;
}

export interface ModValidation {
  ok: boolean;
  issues: ModIssue[];
}

/**
 * Manages the set of mods installed on disk for a given game build
 * (`recompName`): fetching them (and their cross-mod validation) from the
 * Rust side, persisting enable/disable + reorder, auto-sorting to satisfy
 * `requires`/`load_after` hints, sideloading `.zip` archives via a native
 * file picker, removing a mod, and opening its folder.
 *
 * Extracted from `ModsPanel.tsx` so both that panel and any other UI (e.g. a
 * standalone mods page) can share the exact same local-mod logic, including
 * the pointer-based drag-to-reorder state machine.
 *
 * `requires`/`conflicts`/`load_after`/platform-availability/`game_version`
 * are validated on the Rust side (`getModValidation`) against the *enabled*
 * mod set (and, for `game_version`, the installed game version); the same
 * validation gates Play itself (see `getLaunchError`), so `validation` here
 * is purely informative — reorder/enable still apply instantly either way.
 *
 * Dropping `.zip` files on the window while this game is focused is handled
 * globally by FileDropManager, which dispatches `goopie:modschanged` on
 * completion — this hook listens for that to stay in sync.
 */
export function useInstalledMods(recompName: string) {
  const [mods, setMods] = useState<ModInfo[] | null>(null);
  const [validation, setValidation] = useState<ModValidation | null>(null);
  const [installing, setInstalling] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [lastReport, setLastReport] = useState<InstallResult[] | null>(null);

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
    if (typeof w.getModValidation === 'function') {
      const v = w.getModValidation(recompName);
      setValidation(v && Array.isArray(v.issues) ? v : { ok: true, issues: [] });
    }
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

  const handleAutoSort = useCallback(() => {
    const w = window as any;
    if (typeof w.autoSortMods !== 'function') return;
    setSorting(true);
    w.autoSortMods(recompName);
    fetchMods();
    setSorting(false);
  }, [recompName, fetchMods]);

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
    // Reorder/enable can change whether the layout is valid (order, presence
    // in the enabled set) — refresh validation immediately so the banner
    // doesn't lag a stale state until the next unrelated refetch.
    if (typeof w.getModValidation === 'function') {
      const v = w.getModValidation(recompName);
      setValidation(v && Array.isArray(v.issues) ? v : { ok: true, issues: [] });
    }
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

  /** Starts a potential drag from a row's grip handle; promoted to an actual drag once the pointer moves far enough (see the pointermove listener above). */
  const onPointerDownHandle = useCallback((id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pendingDrag.current = { id, x: e.clientX, y: e.clientY };
  }, []);

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
    fetchMods();
  }, [recompName, fetchMods]);

  const handleOpenFolder = useCallback(() => {
    const w = window as any;
    if (typeof w.openModsFolder === 'function') w.openModsFolder(recompName);
  }, [recompName]);

  return {
    mods,
    validation,
    installing,
    sorting,
    lastReport,
    dragId,
    listRef,
    fetchMods,
    toggleEnabled,
    handleReorder,
    onPointerDownHandle,
    handleAutoSort,
    handleRemove,
    handleBrowse,
    handleOpenFolder,
  };
}
