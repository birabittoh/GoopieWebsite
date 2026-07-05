import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, FolderOpen, Upload, GripVertical, AlertTriangle, Package, RefreshCw, ArrowDownUp, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { ConfirmDialog } from './ConfirmDialog';
import { PlatformIcon } from './GameList';
import type { Platform } from '../types/game';

interface ModInfo {
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

interface InstallResult {
  path: string;
  ok: boolean;
  message: string;
}

interface ModIssue {
  id: string;
  kind: 'error' | 'warning';
  message: string;
}

interface ModValidation {
  ok: boolean;
  issues: ModIssue[];
}

/** Maps a mod's `platform` entry prefix (`"windows-x64"`, `"linux-x64"`, `"macos-x64"`) to the `Platform` type used throughout the site (game cards, filters, ...). */
const PLATFORM_PREFIXES: { prefix: string; platform: Platform }[] = [
  { prefix: 'windows', platform: 'Windows' },
  { prefix: 'linux', platform: 'Linux' },
  { prefix: 'macos', platform: 'Mac' },
];

/** One icon per platform this mod actually ships a binary for, reusing the same `PlatformIcon` glyphs as the game list — nothing rendered for a platform it doesn't support (that's an error, surfaced by the row highlight/banner, not a badge here). */
function PlatformBadges({ mod }: { mod: ModInfo }) {
  if (!mod.is_code) return null;

  const supported = PLATFORM_PREFIXES.filter(({ prefix }) => mod.platform.some(p => p.toLowerCase().startsWith(prefix)));
  if (supported.length === 0) return null;

  return (
    <span className="flex items-center gap-1.5 shrink-0">
      {supported.map(({ prefix, platform }) => (
        <PlatformIcon key={prefix} platform={platform} className="w-3.5 h-3.5" />
      ))}
    </span>
  );
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
 * `requires`/`conflicts`/`load_after`/platform-availability/`game_version`
 * are validated on the Rust side (`getModValidation`) against the *enabled*
 * mod set (and, for `game_version`, the installed game version); the same
 * validation gates Play itself (see `getLaunchError`), so a banner here is
 * purely proactive — reorder/enable still apply instantly either way.
 */
export function ModsPanel({ recompName }: ModsPanelProps) {
  const [mods, setMods] = useState<ModInfo[] | null>(null);
  const [validation, setValidation] = useState<ModValidation | null>(null);
  const [installing, setInstalling] = useState(false);
  const [sorting, setSorting] = useState(false);
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

  const errors = validation?.issues.filter(i => i.kind === 'error') ?? [];
  const warnings = validation?.issues.filter(i => i.kind === 'warning') ?? [];
  const erroredIds = new Set(errors.map(i => i.id));
  const hasOrderIssue = (validation?.issues ?? []).some(i => i.message.includes('must load before') || i.message.includes('currently loads first'));
  const hasEnabledCodeMod = mods.some(m => m.enabled && m.is_code);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          Top means highest priority
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleOpenFolder} title="Open mods folder">
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleAutoSort} disabled={sorting || !hasOrderIssue} title="Reorder mods to satisfy their requires/load_after hints">
            <ArrowDownUp className="w-3 h-3 mr-1" /> Auto-sort
          </Button>
          <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleBrowse} disabled={installing}>
            <Upload className="w-3 h-3 mr-1" /> Browse...
          </Button>
        </div>
      </div>

      {hasEnabledCodeMod && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-xs border" style={{ backgroundColor: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.4)', color: '#fdba74' }}>
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Mods are user-submitted and can run arbitrary code on your computer. Only install mods from people you trust.</span>
        </div>
      )}

      {errors.length > 0 && (
        <div className="p-3 rounded-lg text-xs space-y-2 border" style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.4)' }}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-red-300">This layout won't launch until fixed:</p>
            {hasOrderIssue && (
              <button
                type="button"
                onClick={handleAutoSort}
                disabled={sorting}
                className="shrink-0 px-2.5 py-1 rounded text-xs font-bold bg-yellow-500 text-black hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                Fix
              </button>
            )}
          </div>
          {errors.map((issue, i) => (
            <p key={i} className="text-red-300">• {issue.message}</p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-3 rounded-lg text-xs space-y-1 border" style={{ backgroundColor: 'rgba(250,204,21,0.08)', borderColor: 'rgba(250,204,21,0.35)' }}>
          {warnings.map((issue, i) => (
            <p key={i} className="text-yellow-400 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {issue.message}
            </p>
          ))}
        </div>
      )}

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
            const rowHasError = mod.enabled && erroredIds.has(mod.id);
            return (
              <div
                key={mod.id}
                data-mod-id={mod.id}
                className="flex items-center gap-3 p-3 rounded-lg select-none"
                style={{
                  backgroundColor: 'var(--theme-item-default)',
                  opacity: mod.enabled ? (isDragging ? 0.6 : 1) : 0.5,
                  borderLeft: rowHasError ? '3px solid #f87171' : '3px solid transparent',
                }}
              >
                <Switch
                  checked={mod.enabled}
                  onCheckedChange={() => toggleEnabled(mod.id)}
                  className="shrink-0"
                  aria-label={mod.enabled ? `Disable ${mod.name}` : `Enable ${mod.name}`}
                />

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
                    <p
                      className="text-xs flex items-center gap-1 mt-0.5"
                      style={{ color: rowHasError ? '#f87171' : 'var(--theme-text-muted)' }}
                    >
                      {rowHasError && <AlertTriangle className="w-3 h-3 shrink-0" />} Requires: {mod.requires.join(', ')}
                    </p>
                  )}
                  {mod.conflicts.length > 0 && (
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      Conflicts: {mod.conflicts.join(', ')}
                    </p>
                  )}
                  {mod.game_version && (
                    <p
                      className="text-xs flex items-center gap-1 mt-0.5"
                      style={{ color: rowHasError ? '#f87171' : 'var(--theme-text-muted)' }}
                    >
                      {rowHasError && <AlertTriangle className="w-3 h-3 shrink-0" />} Requires game v{mod.game_version}
                    </p>
                  )}
                </div>

                <PlatformBadges mod={mod} />

                <Button size="sm" className="shrink-0 bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => setConfirmRemove(mod)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
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
