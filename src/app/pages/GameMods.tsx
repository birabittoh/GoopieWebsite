import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import {
  ArrowLeft, Package, GripVertical, Search, ShieldAlert, AlertTriangle, RefreshCw,
  Star, Lock, CheckCircle2, HelpCircle, Trash2, Upload, FolderOpen, Plus, X, Download, Pencil,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { PlatformIcon } from '../components/GameList';
import type { Platform } from '../types/game';
import { useGameStore } from '../data/GameStore';
import { useAuth } from '../auth/AuthContext';
import { useBackgroundAccent } from '../theme/BackgroundAccentContext';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';
import {
  useModCatalog,
  submitMod,
  approveMod,
  rejectMod,
  featureMod,
  unfeatureMod,
  requireMod,
  unrequireMod,
  updateModMetadata,
  type CatalogMod,
  type CatalogModStatus,
  type SubmitModInput,
  type ModMetadataPatch,
} from '../data/useModCatalog';
import { useInstalledMods, type ModInfo } from '../hooks/useInstalledMods';
import { getGitHubRepo, fetchReleases, type GameRelease } from '../data/useGameReleases';

/** Maps a mod's `platform` entry prefix to the `Platform` type used elsewhere on the site. */
const PLATFORM_PREFIXES: { prefix: string; platform: Platform }[] = [
  { prefix: 'windows', platform: 'Windows' },
  { prefix: 'linux', platform: 'Linux' },
  { prefix: 'macos', platform: 'Mac' },
];

function PlatformBadges({ platform, isCode }: { platform: string[] | undefined; isCode: boolean | undefined }) {
  if (!isCode || !platform || platform.length === 0) return null;
  const supported = PLATFORM_PREFIXES.filter(({ prefix }) => platform.some(p => p.toLowerCase().startsWith(prefix)));
  if (supported.length === 0) return null;
  return (
    <span className="flex items-center gap-2 shrink-0">
      {supported.map(({ prefix, platform: p }) => (
        <PlatformIcon key={prefix} platform={p} className="w-5 h-5" />
      ))}
    </span>
  );
}

/** Order Required → Featured → Approved → Unapproved, matching the catalog's status semantics. */
const STATUS_ORDER: Record<CatalogModStatus, number> = {
  required: 0,
  featured: 1,
  approved: 2,
  unapproved: 3,
};

const STATUS_LABEL: Record<CatalogModStatus, string> = {
  required: 'Required',
  featured: 'Featured',
  approved: 'Approved',
  unapproved: 'Unapproved',
};

function StatusBadge({ status }: { status: CatalogModStatus }) {
  const colors: Record<CatalogModStatus, { bg: string; fg: string }> = {
    required: { bg: 'rgba(248,113,113,0.18)', fg: '#f87171' },
    featured: { bg: 'rgba(250,204,21,0.18)', fg: '#facc15' },
    approved: { bg: 'rgba(74,222,128,0.18)', fg: '#4ade80' },
    unapproved: { bg: 'rgba(148,163,184,0.18)', fg: '#94a3b8' },
  };
  const c = colors[status];
  return (
    <span
      className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Marks a mod installed via the local Sideload/drag-drop path — never submitted to (or resolved from) the catalog, so it has no moderation status and won't auto-update. */
function SideloadBadge() {
  return (
    <span
      className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
      style={{ backgroundColor: 'rgba(96,165,250,0.18)', color: '#60a5fa' }}
      title="Installed locally via Sideload/drag-drop — not from the mod catalog"
    >
      Sideloaded
    </span>
  );
}

/** Unified row model correlating a Firestore catalog entry with its on-disk installed counterpart. */
interface ModRow {
  key: string;
  catalogMod?: CatalogMod;
  installed?: ModInfo;
  isInstalled: boolean;
}

type InstalledFilter = 'all' | 'installed' | 'not-installed';
type StatusFilter = 'all' | CatalogModStatus;

/** Derives a slug from free text loosely matching the launcher's `sanitize_mod_id`: alphanumeric/-/_/. kept, else `_`. */
function sanitizeModId(input: string): string {
  return input.replace(/[^a-zA-Z0-9\-_.]/g, '_');
}

/** Parses `owner/repo` out of a full GitHub URL or a bare `owner/repo` string. */
function parseGitHubRepoInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  if (urlMatch) return urlMatch[1];
  if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) return trimmed;
  return null;
}

/** One row in the requirements editor: a dependency's `modId` plus an optional minimum-version pin. */
interface RequirementRow {
  modId: string;
  minVersion: string;
}

/** Full set of editable mod metadata, shared between the Submit and Edit forms. */
interface ModMetaState {
  name: string;
  author: string;
  description: string;
  version: string;
  iconUrl: string;
  requires: RequirementRow[];
  /** One screenshot URL per line. */
  screenshotsText: string;
  /** One YouTube URL (or bare video ID) per line. */
  videosText: string;
}

function emptyModMetaState(): ModMetaState {
  return { name: '', author: '', description: '', version: '', iconUrl: '', requires: [], screenshotsText: '', videosText: '' };
}

/** Splits a `"modId >= 1.2.0"` / bare-`"modId"` requirement string into a row, the inverse of [`serializeRequirements`]. */
function parseRequirementString(entry: string): RequirementRow {
  const [modId, minVersion] = entry.split('>=').map(s => s.trim());
  return { modId: modId ?? '', minVersion: minVersion ?? '' };
}

/** Renders requirement rows back to the `"modId"` / `"modId >= 1.2.0"` string form the launcher's manifest `requires` field uses. */
function serializeRequirements(rows: RequirementRow[]): string[] {
  return rows
    .filter(r => r.modId.trim())
    .map(r => (r.minVersion.trim() ? `${r.modId.trim()} >= ${r.minVersion.trim()}` : r.modId.trim()));
}

/** Splits a textarea's newline/comma-separated URL list into individual trimmed, non-empty entries. */
function parseUrlList(text: string): string[] {
  return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

function modMetaStateFromCatalog(cm: CatalogMod): ModMetaState {
  return {
    name: cm.name ?? '',
    author: cm.author ?? '',
    description: cm.description ?? '',
    version: cm.version ?? '',
    iconUrl: cm.iconUrl ?? '',
    requires: (cm.requires ?? []).map(parseRequirementString),
    screenshotsText: (cm.screenshots ?? []).join('\n'),
    videosText: (cm.videoUrls ?? []).join('\n'),
  };
}

interface ModMetaFieldsEditorProps {
  state: ModMetaState;
  onChange: (next: ModMetaState) => void;
}

/**
 * Shared metadata editor used by both the Submit and Edit mod forms — name,
 * author, description, version, icon URL, a repeatable requirements list
 * (each with an optional minimum-version pin, matching the launcher's
 * `mod.toml` `requires` semantics — see `mods.rs`'s `ModRequirement`), and
 * screenshot/YouTube URL lists (one per line).
 */
function ModMetaFieldsEditor({ state, onChange }: ModMetaFieldsEditorProps) {
  const inputStyle = { backgroundColor: 'var(--theme-item-default)', color: 'var(--theme-text-primary)' };
  const labelStyle = { color: 'var(--theme-text-muted)' };

  const setRequirement = (i: number, patch: Partial<RequirementRow>) => {
    const next = state.requires.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...state, requires: next });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs" style={labelStyle}>Name</label>
          <input value={state.name} onChange={e => onChange({ ...state, name: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs" style={labelStyle}>Author</label>
          <input value={state.author} onChange={e => onChange({ ...state, author: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </div>
      </div>
      <div>
        <label className="text-xs" style={labelStyle}>Description</label>
        <textarea value={state.description} onChange={e => onChange({ ...state, description: e.target.value })} rows={2} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs" style={labelStyle}>Version</label>
          <input value={state.version} onChange={e => onChange({ ...state, version: e.target.value })} placeholder="1.0.0" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs" style={labelStyle}>Icon URL</label>
          <input value={state.iconUrl} onChange={e => onChange({ ...state, iconUrl: e.target.value })} placeholder="https://..." className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs" style={labelStyle}>
            Requirements <span className="opacity-70">(other mods this one needs — optionally pin a minimum version)</span>
          </label>
          <button
            type="button"
            onClick={() => onChange({ ...state, requires: [...state.requires, { modId: '', minVersion: '' }] })}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ color: 'var(--theme-accent)' }}
          >
            + Add
          </button>
        </div>
        <div className="space-y-1.5 mt-1">
          {state.requires.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={row.modId}
                onChange={e => setRequirement(i, { modId: e.target.value })}
                placeholder="mod id"
                className="flex-1 min-w-0 px-2 py-1.5 rounded text-sm outline-none"
                style={inputStyle}
              />
              <span className="text-xs shrink-0" style={labelStyle}>&gt;=</span>
              <input
                value={row.minVersion}
                onChange={e => setRequirement(i, { minVersion: e.target.value })}
                placeholder="1.0.0 (optional)"
                className="w-32 shrink-0 px-2 py-1.5 rounded text-sm outline-none"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => onChange({ ...state, requires: state.requires.filter((_, j) => j !== i) })}
                className="shrink-0 p-1 rounded"
                style={{ color: 'var(--theme-text-muted)' }}
                aria-label="Remove requirement"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs" style={labelStyle}>Screenshot URLs (one per line)</label>
        <textarea value={state.screenshotsText} onChange={e => onChange({ ...state, screenshotsText: e.target.value })} rows={2} placeholder={'https://.../shot1.png\nhttps://.../shot2.png'} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
      </div>
      <div>
        <label className="text-xs" style={labelStyle}>YouTube video URLs (one per line)</label>
        <textarea value={state.videosText} onChange={e => onChange({ ...state, videosText: e.target.value })} rows={2} placeholder={'https://www.youtube.com/watch?v=...'} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
      </div>
    </div>
  );
}

/** Extracts a YouTube video ID from a full URL (`watch?v=`, `youtu.be/`, `embed/`) or passes through a bare ID. */
function youtubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed)) return trimmed;
  return null;
}

export function GameMods() {
  const { recompName } = useParams<{ recompName: string }>();
  const { games } = useGameStore();
  const { user, canEditGame } = useAuth();
  const { setAccentColor } = useBackgroundAccent();

  const game = games.find(g => g.recompName.toLowerCase() === (recompName ?? '').toLowerCase());
  const privileged = game ? canEditGame(game.id) : false;

  useEffect(() => {
    setAccentColor(game?.accentColor);
    return () => setAccentColor(undefined);
  }, [game?.accentColor, setAccentColor]);

  const { mods: catalogMods } = useModCatalog(game?.id ?? '');
  const installedHook = useInstalledMods(recompName ?? '');
  const { mods: installedMods, validation, dragId, listRef, toggleEnabled, handleReorder, onPointerDownHandle,
    handleRemove, handleBrowse, handleOpenFolder, installing, lastReport } = installedHook;

  const [search, setSearch] = useState('');
  const [installedFilter, setInstalledFilter] = useState<InstalledFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [focusedModId, setFocusedModId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ModInfo | null>(null);
  const [confirmReject, setConfirmReject] = useState<CatalogMod | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [editingMod, setEditingMod] = useState<CatalogMod | null>(null);

  // Build the merged row model: correlate catalog entries with installed mods
  // by id (catalogMod.modId === installed.id).
  const rows = useMemo<ModRow[]>(() => {
    const installedById = new Map((installedMods ?? []).map(m => [m.id, m]));
    const usedInstalledIds = new Set<string>();
    const result: ModRow[] = [];

    for (const cm of catalogMods) {
      // Only show unapproved mods to their submitter or a privileged user.
      if (cm.status === 'unapproved' && !privileged && cm.submittedBy !== user?.uid) continue;
      const installed = installedById.get(cm.modId);
      if (installed) usedInstalledIds.add(installed.id);
      result.push({ key: cm.modId, catalogMod: cm, installed, isInstalled: !!installed });
    }

    for (const im of installedMods ?? []) {
      if (usedInstalledIds.has(im.id)) continue;
      result.push({ key: im.id, installed: im, isInstalled: true });
    }

    return result;
  }, [catalogMods, installedMods, privileged, user?.uid]);

  // The "Unapproved" filter is only meaningful (and only shown) to viewers who
  // can actually see any unapproved mods: admins/assigned developers see every
  // game's queue, and a normal user sees only their own pending submissions.
  const canSeeUnapproved = privileged || catalogMods.some(cm => cm.status === 'unapproved' && cm.submittedBy === user?.uid);

  useEffect(() => {
    if (statusFilter === 'unapproved' && !canSeeUnapproved) setStatusFilter('all');
  }, [statusFilter, canSeeUnapproved]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(row => {
      if (installedFilter === 'installed' && !row.isInstalled) return false;
      if (installedFilter === 'not-installed' && row.isInstalled) return false;
      if (statusFilter !== 'all' && row.catalogMod?.status !== statusFilter) return false;
      if (q) {
        const name = (row.catalogMod?.name ?? row.installed?.name ?? '').toLowerCase();
        const author = (row.catalogMod?.author ?? row.installed?.author ?? '').toLowerCase();
        const description = (row.catalogMod?.description ?? row.installed?.description ?? '').toLowerCase();
        if (!name.includes(q) && !author.includes(q) && !description.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, installedFilter, statusFilter]);

  const sortedRows = useMemo(() => {
    const installedOrder = new Map((installedMods ?? []).map((m, i) => [m.id, i]));
    return [...filteredRows].sort((a, b) => {
      const sa = a.catalogMod ? STATUS_ORDER[a.catalogMod.status] : 4;
      const sb = b.catalogMod ? STATUS_ORDER[b.catalogMod.status] : 4;
      if (sa !== sb) return sa - sb;
      const oa = a.installed ? installedOrder.get(a.installed.id) ?? 0 : 0;
      const ob = b.installed ? installedOrder.get(b.installed.id) ?? 0 : 0;
      return oa - ob;
    });
  }, [filteredRows, installedMods]);

  const showDragHandles = installedFilter === 'installed';

  const focusedRow = sortedRows.find(r => r.key === focusedModId) ?? rows.find(r => r.key === focusedModId);

  if (!recompName) return null;
  if (!game || !game.modsEnabled) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--theme-text-muted)' }}>
        <p>This game doesn't support mods. <Link to="/library" className="underline">Back to Library</Link></p>
      </div>
    );
  }

  const errors = validation?.issues.filter(i => i.kind === 'error') ?? [];
  const warnings = validation?.issues.filter(i => i.kind === 'warning') ?? [];
  const hasEnabledCodeMod = (installedMods ?? []).some(m => m.enabled && m.is_code);

  return (
    <div className="flex h-screen flex-col relative" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
      <div
        className="h-16 border-b flex items-center px-6 gap-4 relative z-20 shrink-0"
        style={{ backgroundColor: 'var(--theme-topbar-bg)', borderColor: 'var(--theme-border)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}
      >
        <Link to={`/library/${game.recompName}`}>
          <Button variant="ghost" size="icon" className="shrink-0" style={{ color: 'var(--theme-text-primary)' }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold truncate flex-1 min-w-0" style={{ color: 'var(--theme-text-primary)' }}>
          Mods — {game.title}
        </h1>
        {user && (
          <Button size="sm" className="shrink-0 bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={() => setShowSubmitModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Submit a mod
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative z-10">
        <div className="h-full flex gap-4 p-4 md:p-6">
          {/* Left column: merged mod list */}
          <div className="w-full md:w-1/3 min-w-[260px] flex flex-col gap-3 overflow-hidden">
            {hasEnabledCodeMod && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs border shrink-0" style={{ backgroundColor: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.4)', color: '#fdba74' }}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Mods can run arbitrary code. Only install mods from people you trust.</span>
              </div>
            )}
            {errors.length > 0 && (
              <div className="p-2.5 rounded-lg text-xs space-y-1 border shrink-0" style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.4)' }}>
                <p className="font-semibold text-red-300">This layout won't launch:</p>
                {errors.map((issue, i) => <p key={i} className="text-red-300">• {issue.message}</p>)}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="p-2.5 rounded-lg text-xs space-y-1 border shrink-0" style={{ backgroundColor: 'rgba(250,204,21,0.08)', borderColor: 'rgba(250,204,21,0.35)' }}>
                {warnings.map((issue, i) => (
                  <p key={i} className="text-yellow-400 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {issue.message}
                  </p>
                ))}
              </div>
            )}

            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search mods..."
                className="w-full pl-8 pr-8 py-1.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: 'var(--theme-item-default)', color: 'var(--theme-text-primary)' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-80"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 shrink-0">
              {(['all', 'installed', 'not-installed'] as InstalledFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setInstalledFilter(f)}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: installedFilter === f ? 'var(--theme-accent)' : 'var(--theme-item-default)',
                    color: installedFilter === f ? 'white' : 'var(--theme-text-muted)',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'installed' ? 'Installed' : 'Not installed'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {(['all', 'required', 'featured', 'approved', 'unapproved'] as StatusFilter[])
                .filter(f => f !== 'unapproved' || canSeeUnapproved)
                .map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: statusFilter === f ? 'var(--theme-accent)' : 'var(--theme-item-default)',
                    color: statusFilter === f ? 'white' : 'var(--theme-text-muted)',
                  }}
                >
                  {f === 'all' ? 'Any status' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" onClick={handleOpenFolder} title="Open mods folder" style={{ color: 'var(--theme-text-primary)' }}>
                <FolderOpen className="w-4 h-4" />
              </Button>
              <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleBrowse} disabled={installing}>
                <Upload className="w-3 h-3 mr-1" /> Sideload...
              </Button>
            </div>

            {installing && (
              <div className="flex items-center gap-2 p-2 rounded-lg shrink-0" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
                <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ color: 'var(--theme-accent)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--theme-text-primary)' }}>Installing...</span>
              </div>
            )}
            {lastReport && (
              <div className="p-2 rounded-lg text-xs space-y-1 shrink-0" style={{ backgroundColor: 'var(--theme-item-default)' }}>
                {lastReport.map((r, i) => (
                  <div key={i} className={r.ok ? 'text-green-400' : 'text-red-300'}>
                    {r.ok ? r.message : `${r.path.split(/[\\/]/).pop()}: ${r.message}`}
                  </div>
                ))}
              </div>
            )}

            <div ref={listRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sortedRows.length === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: 'var(--theme-text-muted)' }}>
                  No mods match.
                </p>
              ) : sortedRows.map(row => {
                const status = row.catalogMod?.status;
                const name = row.catalogMod?.name ?? row.installed?.name ?? row.key;
                const version = row.catalogMod?.version ?? row.installed?.version;
                const author = row.catalogMod?.author ?? row.installed?.author;
                const icon = row.installed?.icon;
                const isDragging = dragId === row.installed?.id;
                const isFocused = focusedModId === row.key;
                return (
                  <div
                    key={row.key}
                    data-mod-id={row.installed?.id ?? row.key}
                    onClick={() => setFocusedModId(row.key)}
                    className="flex items-center gap-3 p-3 rounded-lg select-none cursor-pointer"
                    style={{
                      backgroundColor: isFocused ? 'var(--theme-item-selected)' : 'var(--theme-item-default)',
                      opacity: row.installed && !row.installed.enabled ? 0.5 : (isDragging ? 0.6 : 1),
                      border: isFocused ? '1px solid var(--theme-accent)' : status === 'unapproved' ? '1px dashed rgba(148,163,184,0.6)' : '1px solid transparent',
                    }}
                  >
                    {showDragHandles && row.installed && (
                      <span
                        className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
                        style={{ color: 'var(--theme-text-muted)' }}
                        onPointerDown={(e) => { e.stopPropagation(); onPointerDownHandle(row.installed!.id, e); }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="w-5 h-5" />
                      </span>
                    )}
                    <div
                      className="shrink-0 w-11 h-11 flex items-center justify-center overflow-hidden rounded"
                      style={icon ? undefined : { backgroundColor: 'var(--theme-item-selected)' }}
                    >
                      {icon ? <img src={icon} alt="" className="w-11 h-11 object-cover" /> : <Package className="w-5 h-5" style={{ color: 'var(--theme-text-muted)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {status ? <StatusBadge status={status} /> : row.installed && <SideloadBadge />}
                        <p className="text-base font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
                          {name}{version && <span className="font-normal ml-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>v{version}</span>}
                        </p>
                      </div>
                      {author && <p className="text-sm truncate" style={{ color: 'var(--theme-text-muted)' }}>{author}</p>}
                    </div>
                    <PlatformBadges platform={row.installed?.platform ?? row.catalogMod?.platform} isCode={row.installed?.is_code} />
                    {row.installed ? (
                      <Switch
                        checked={row.installed.enabled}
                        onCheckedChange={() => toggleEnabled(row.installed!.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      />
                    ) : (
                      <span className="text-xs shrink-0" style={{ color: 'var(--theme-text-muted)' }}>Not installed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: focused mod detail panel */}
          <div className="hidden md:flex flex-1 overflow-y-auto rounded-lg p-6" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            {focusedRow ? (
              <ModDetailPanel
                row={focusedRow}
                recompName={recompName}
                privileged={privileged}
                allCatalogMods={catalogMods}
                installedMods={installedMods}
                onRemove={(mod) => setConfirmRemove(mod)}
                onToggleEnabled={toggleEnabled}
                onFetchMods={installedHook.fetchMods}
                onReject={(cm) => setConfirmReject(cm)}
                onEdit={(cm) => setEditingMod(cm)}
                onFocusMod={(key) => {
                  // A required/conflicting mod might be filtered out of view
                  // (status filter, installed-only, or a stale search) —
                  // clear those so the row we're jumping to is guaranteed visible.
                  setStatusFilter('all');
                  setInstalledFilter('all');
                  setSearch('');
                  setFocusedModId(key);
                  requestAnimationFrame(() => {
                    listRef.current?.querySelector(`[data-mod-id="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
                  });
                }}
              />
            ) : (
              <p className="m-auto text-sm" style={{ color: 'var(--theme-text-muted)' }}>Select a mod to see details.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Confirm"
        description={`Remove mod "${confirmRemove?.name ?? ''}"? This deletes its files.`}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => { if (confirmRemove) handleRemove(confirmRemove); setConfirmRemove(null); }}
      />
      <ConfirmDialog
        open={!!confirmReject}
        title="Reject submission?"
        description={`Reject and delete "${confirmReject?.name ?? ''}"? This can't be undone.`}
        confirmLabel="Reject"
        onCancel={() => setConfirmReject(null)}
        onConfirm={() => { if (confirmReject) rejectMod(confirmReject.id); setConfirmReject(null); }}
      />

      {showSubmitModal && game && user && (
        <SubmitModModal
          game={game}
          recompName={recompName}
          userUid={user.uid}
          userName={user.username ?? user.email ?? 'Unknown'}
          existingModIds={new Set(catalogMods.map(m => m.modId))}
          onClose={() => setShowSubmitModal(false)}
        />
      )}

      {editingMod && (
        <EditModModal mod={editingMod} onClose={() => setEditingMod(null)} />
      )}
    </div>
  );
}

/** Polls `isInstallingMods` until an in-flight install (started via `installModFromUrl`) finishes. */
function waitForInstallToFinish(w: any): Promise<void> {
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (w.isInstallingMods && w.isInstallingMods()) return;
      clearInterval(iv);
      resolve();
    }, 400);
  });
}

interface ModDetailPanelProps {
  row: ModRow;
  recompName: string;
  privileged: boolean;
  allCatalogMods: CatalogMod[];
  installedMods: ModInfo[] | null;
  onRemove: (mod: ModInfo) => void;
  onToggleEnabled: (id: string) => void;
  onFetchMods: () => void;
  onReject: (cm: CatalogMod) => void;
  onEdit: (cm: CatalogMod) => void;
  onFocusMod: (key: string) => void;
}

function ModDetailPanel({ row, recompName, privileged, allCatalogMods, installedMods, onRemove, onToggleEnabled, onFetchMods, onReject, onEdit, onFocusMod }: ModDetailPanelProps) {
  const { catalogMod: cm, installed, isInstalled } = row;
  const [installingUrl, setInstallingUrl] = useState(false);

  const name = cm?.name ?? installed?.name ?? row.key;
  const version = cm?.version ?? installed?.version;
  const author = cm?.author ?? installed?.author;
  const description = cm?.description ?? installed?.description;
  const requires = installed?.requires ?? cm?.requires ?? [];
  const conflicts = installed?.conflicts ?? [];
  const platform = installed?.platform ?? cm?.platform ?? [];
  const gameVersion = installed?.game_version;
  const icon = installed?.icon || cm?.iconUrl;

  const canInstallFromUrl = isLauncherVersionAtLeast('1.7.0') && typeof (window as any).installModFromUrl === 'function';

  // Installing a mod also pulls in the latest published version of each of
  // its requirements first (skipping ones already installed), so a player
  // doesn't have to hunt down and install dependencies by hand one at a time.
  const handleInstall = useCallback(async () => {
    if (!cm?.assetUrl || !cm.modId) return;
    const w = window as any;
    if (typeof w.installModFromUrl !== 'function') return;

    setInstallingUrl(true);
    try {
      const installedIds = new Set((installedMods ?? []).map(m => m.id));
      for (const reqEntry of cm.requires ?? []) {
        const reqId = reqEntry.split('>=')[0].trim();
        if (!reqId || reqId === cm.modId || installedIds.has(reqId)) continue;
        const reqMod = allCatalogMods.find(m => m.modId === reqId);
        if (!reqMod?.assetUrl) continue; // nothing we can auto-install for this requirement
        w.installModFromUrl(recompName, reqMod.assetUrl, reqMod.modId);
        await waitForInstallToFinish(w);
      }

      w.installModFromUrl(recompName, cm.assetUrl, cm.modId);
      await waitForInstallToFinish(w);
    } finally {
      setInstallingUrl(false);
      onFetchMods();
    }
  }, [cm, recompName, onFetchMods, installedMods, allCatalogMods]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 w-16 h-16 flex items-center justify-center overflow-hidden rounded-lg"
          style={icon ? undefined : { backgroundColor: 'var(--theme-item-default)' }}
        >
          {icon ? <img src={icon} alt="" className="w-16 h-16 object-cover" /> : <Package className="w-6 h-6" style={{ color: 'var(--theme-text-muted)' }} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {cm ? <StatusBadge status={cm.status} /> : installed && <SideloadBadge />}
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--theme-text-primary)' }}>{name}</h2>
            {version && <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>v{version}</span>}
          </div>
          {author && <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>by {author}</p>}
        </div>
      </div>

      {description && <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{description}</p>}

      <div className="text-xs space-y-1" style={{ color: 'var(--theme-text-muted)' }}>
        {requires.length > 0 && (
          <p>
            Requires:{' '}
            {requires.map((req, i) => {
              const reqId = req.split('>=')[0].trim();
              return (
                <span key={reqId}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    onClick={() => onFocusMod(reqId)}
                    className="underline hover:opacity-80"
                    style={{ color: 'var(--theme-accent)' }}
                  >
                    {req}
                  </button>
                </span>
              );
            })}
          </p>
        )}
        {conflicts.length > 0 && <p>Conflicts: {conflicts.join(', ')}</p>}
        {platform.length > 0 && (
          <p className="flex items-center gap-1.5">
            Platforms: <PlatformBadges platform={platform} isCode />
          </p>
        )}
        {gameVersion && <p>Requires game v{gameVersion}</p>}
        {cm?.githubRepo && <p>Source: {cm.githubRepo}</p>}
      </div>

      {cm && (cm.screenshots?.length || cm.videoUrls?.length) ? (
        <div className="space-y-3">
          {cm.screenshots && cm.screenshots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cm.screenshots.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-28 h-16 rounded overflow-hidden shrink-0" style={{ backgroundColor: 'var(--theme-item-default)' }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          {cm.videoUrls && cm.videoUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {cm.videoUrls.map((url, i) => {
                const id = youtubeVideoId(url);
                if (!id) return null;
                return (
                  <div key={i} className="w-64 aspect-video rounded overflow-hidden shrink-0">
                    <iframe
                      src={`https://www.youtube.com/embed/${id}`}
                      title={`${name} video ${i + 1}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
        {!isInstalled && cm?.assetUrl && canInstallFromUrl && (
          <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleInstall} disabled={installingUrl}>
            <Download className="w-3.5 h-3.5 mr-1" /> {installingUrl ? 'Installing...' : 'Install'}
          </Button>
        )}
        {!isInstalled && cm && !cm.assetUrl && (
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>No asset resolved yet.</p>
        )}
        {installed && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onToggleEnabled(installed.id)} style={{ color: 'var(--theme-text-primary)' }}>
              {installed.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => onRemove(installed)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
            </Button>
          </>
        )}

        {privileged && cm && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onEdit(cm)} style={{ color: 'var(--theme-text-primary)' }}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
            {cm.status === 'unapproved' && (
              <>
                <Button size="sm" className="bg-green-700 hover:bg-green-600 text-white" onClick={() => approveMod(cm.id, '' )}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => onReject(cm)}>
                  <X className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </>
            )}
            {cm.status === 'approved' && (
              <>
                <Button size="sm" variant="ghost" onClick={() => featureMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                  <Star className="w-3.5 h-3.5 mr-1" /> Feature
                </Button>
                <Button size="sm" variant="ghost" onClick={() => requireMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                  <Lock className="w-3.5 h-3.5 mr-1" /> Require
                </Button>
              </>
            )}
            {cm.status === 'featured' && (
              <Button size="sm" variant="ghost" onClick={() => unfeatureMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                <Star className="w-3.5 h-3.5 mr-1" /> Unfeature
              </Button>
            )}
            {cm.status === 'required' && (
              <Button size="sm" variant="ghost" onClick={() => unrequireMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                <Lock className="w-3.5 h-3.5 mr-1" /> Unrequire
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface SubmitModModalProps {
  game: { id: string; recompName: string };
  recompName: string;
  userUid: string;
  userName: string;
  /** modIds already taken for this game — a mod's `modId` becomes its on-disk folder name (see `mods.rs`), so it must be unique per game. */
  existingModIds: Set<string>;
  onClose: () => void;
}

/** The resolved release+asset a submission will point at — fetched once, then reused unmodified all the way through to `submitMod`, per the plan's rate-limit discipline. */
interface ResolvedAsset {
  repo: string;
  tag: string;
  assetName: string;
  assetUrl: string;
}

function SubmitModModal({ game, recompName, userUid, userName, existingModIds, onClose }: SubmitModModalProps) {
  const [repoInput, setRepoInput] = useState('');
  const [tag, setTag] = useState('');
  const [assetRegex, setAssetRegex] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedAsset | null>(null);
  const [modId, setModId] = useState('');
  const [meta, setMeta] = useState<ModMetaState>(emptyModMetaState());
  // Auto-detected from the zip's mod.toml (see `mods.rs`'s `platform` field) —
  // not user-editable, just carried through from fetch to submit.
  const [platform, setPlatform] = useState<string[] | undefined>(undefined);

  const canAutoFetchMetadata = isLauncherVersionAtLeast('1.7.0') && typeof (window as any).fetchModMetadata === 'function';

  // Phase 1: resolve the repo's release/asset (one GitHub API hit, cached by
  // fetchReleases) and, if running in-launcher, auto-fill metadata from the
  // zip's mod.toml. The user can still edit everything below before phase 2.
  const handleFetch = useCallback(async () => {
    setError(null);
    const repo = parseGitHubRepoInput(repoInput) ?? getGitHubRepo({ githubRepo: repoInput, githubReleaseUrl: undefined, githubApiUrl: undefined });
    if (!repo) { setError('Enter a valid "owner/repo" or GitHub URL.'); return; }

    setBusy(true);
    try {
      let releases: GameRelease[];
      try {
        releases = await fetchReleases(repo);
      } catch {
        setError('Could not fetch releases for that repo.');
        return;
      }

      const release = tag.trim() ? releases.find(r => r.tag === tag.trim()) : releases[0];
      if (!release) { setError('No matching release found.'); return; }

      const asset = assetRegex.trim()
        ? release.assets.find(a => { try { return new RegExp(assetRegex.trim()).test(a.name); } catch { return false; } })
        : release.assets.find(a => a.name.toLowerCase().endsWith('.zip'));
      if (!asset) { setError('No matching asset (zip) found in that release.'); return; }

      setResolved({ repo, tag: release.tag, assetName: asset.name, assetUrl: asset.url });

      const fallbackName = repo.split('/')[1] || repo;
      let fetchedMeta: Partial<ModMetaState> = {};
      let fetchedModId: string | undefined;
      let nextPlatform: string[] | undefined;

      if (canAutoFetchMetadata) {
        try {
          const fetched = (window as any).fetchModMetadata(asset.url);
          if (fetched) {
            fetchedMeta = {
              name: fetched.name || undefined,
              author: fetched.author || undefined,
              description: fetched.description || undefined,
              version: fetched.version || undefined,
              iconUrl: fetched.icon || undefined,
              requires: fetched.requires?.length ? fetched.requires.map(parseRequirementString) : undefined,
            };
            fetchedModId = fetched.name ? sanitizeModId(fetched.name) : undefined;
            nextPlatform = fetched.platform;
          }
        } catch {
          // Fall back to whatever the user's already typed / the derived defaults below.
        }
      }

      // Merge onto whatever's already in the form rather than overwriting it,
      // so text the user typed before clicking Fetch (or a manual override
      // after a first fetch) survives a (re-)fetch — only fields still blank
      // get the fetched/derived value.
      setMeta(prev => ({
        name: prev.name || fetchedMeta.name || fallbackName,
        author: prev.author || fetchedMeta.author || '',
        description: prev.description || fetchedMeta.description || '',
        version: prev.version || fetchedMeta.version || release.tag,
        iconUrl: prev.iconUrl || fetchedMeta.iconUrl || '',
        requires: prev.requires.length ? prev.requires : (fetchedMeta.requires ?? []),
        screenshotsText: prev.screenshotsText,
        videosText: prev.videosText,
      }));
      setModId(prev => prev || fetchedModId || sanitizeModId(fallbackName));
      setPlatform(prev => prev ?? nextPlatform);
    } finally {
      setBusy(false);
    }
  }, [repoInput, tag, assetRegex, canAutoFetchMetadata]);

  const handleSubmit = useCallback(async () => {
    if (!resolved) return;
    setError(null);

    if (existingModIds.has(modId)) {
      setError(`A mod with the folder name "${modId}" already exists for this game. Change the mod id below and resubmit.`);
      return;
    }

    setBusy(true);
    try {
      const input: SubmitModInput = {
        gameId: game.id,
        recompName,
        githubRepo: resolved.repo,
        tag: resolved.tag,
        assetRegex: assetRegex.trim() || undefined,
        assetName: resolved.assetName,
        modId,
        name: meta.name || modId,
        author: meta.author,
        description: meta.description,
        version: meta.version || resolved.tag,
        platform,
        requires: serializeRequirements(meta.requires),
        iconUrl: meta.iconUrl || undefined,
        screenshots: parseUrlList(meta.screenshotsText),
        videoUrls: parseUrlList(meta.videosText),
        submittedBy: userUid,
        submittedByName: userName,
      };

      // Stash the resolved asset URL on the doc too (SubmitModInput doesn't
      // declare it, but submitMod filters out undefined and passes the rest
      // through as-is) — read once here, never re-fetched by the browser.
      await submitMod({ ...input, assetUrl: resolved.assetUrl } as SubmitModInput & { assetUrl: string });
      onClose();
    } catch (e) {
      // Most commonly a modId collision (submitMod rejects if the deterministic
      // gameId+modId doc already exists) that slipped past the client-side
      // existingModIds check due to a race with another concurrent submission.
      setError(e instanceof Error ? e.message : 'Failed to submit mod.');
    } finally {
      setBusy(false);
    }
  }, [resolved, modId, existingModIds, meta, platform, game.id, recompName, assetRegex, userUid, userName, onClose]);

  const inputStyle = { backgroundColor: 'var(--theme-item-default)', color: 'var(--theme-text-primary)' };
  const labelStyle = { color: 'var(--theme-text-muted)' };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Submit a mod</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs" style={labelStyle}>GitHub repo (owner/repo or URL)</label>
            <input value={repoInput} onChange={e => setRepoInput(e.target.value)} placeholder="owner/repo" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs" style={labelStyle}>Release tag (optional, defaults to latest)</label>
              <input value={tag} onChange={e => setTag(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs" style={labelStyle}>Asset regex (optional)</label>
              <input value={assetRegex} onChange={e => setAssetRegex(e.target.value)} placeholder="for multi-mod releases" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
            </div>
          </div>

          <Button size="sm" variant="ghost" onClick={handleFetch} disabled={busy} style={{ color: 'var(--theme-accent)' }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> {resolved ? 'Re-fetch from GitHub' : 'Fetch from GitHub'}
          </Button>

          {resolved ? (
            <p className="text-xs" style={labelStyle}>Resolved: {resolved.tag} / {resolved.assetName}</p>
          ) : (
            <p className="text-xs flex items-center gap-1" style={labelStyle}>
              <HelpCircle className="w-3 h-3 inline shrink-0" /> Fetch a release to resolve the download asset.
            </p>
          )}
          {resolved && !canAutoFetchMetadata && (
            <p className="text-xs flex items-center gap-1" style={labelStyle}>
              <HelpCircle className="w-3 h-3 inline shrink-0" /> Not running in the launcher — metadata wasn't auto-filled; enter it below.
            </p>
          )}

          <div>
            <label className="text-xs" style={labelStyle}>Mod id (unique on-disk folder name)</label>
            <input value={modId} onChange={e => setModId(sanitizeModId(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
            {existingModIds.has(modId) && <p className="text-xs text-red-300 mt-1">This id is already taken for this game.</p>}
          </div>

          <ModMetaFieldsEditor state={meta} onChange={setMeta} />

          {error && <p className="text-xs text-red-300">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} style={{ color: 'var(--theme-text-primary)' }}>Cancel</Button>
            <Button className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleSubmit} disabled={busy || !resolved}>
              {busy ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EditModModalProps {
  mod: CatalogMod;
  onClose: () => void;
}

/** Privileged-only editor for an existing catalog entry's metadata — mirrors editing a game's details, using the same field set as [`SubmitModModal`]'s phase 2. */
function EditModModal({ mod, onClose }: EditModModalProps) {
  const [meta, setMeta] = useState<ModMetaState>(() => modMetaStateFromCatalog(mod));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const patch: ModMetadataPatch = {
        name: meta.name,
        author: meta.author,
        description: meta.description,
        version: meta.version,
        iconUrl: meta.iconUrl || undefined,
        requires: serializeRequirements(meta.requires),
        screenshots: parseUrlList(meta.screenshotsText),
        videoUrls: parseUrlList(meta.videosText),
      };
      await updateModMetadata(mod.id, patch);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setBusy(false);
    }
  }, [mod.id, meta, onClose]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Edit mod — {mod.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            Source: {mod.githubRepo} ({mod.tag ?? 'latest'}, {mod.assetName ?? 'auto-detected asset'}). The mod id and source repo aren't editable here — reject and resubmit if either needs to change.
          </p>
          <ModMetaFieldsEditor state={meta} onChange={setMeta} />

          {error && <p className="text-xs text-red-300">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} style={{ color: 'var(--theme-text-primary)' }}>Cancel</Button>
            <Button className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
