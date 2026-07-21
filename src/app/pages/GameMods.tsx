import { useEffect, useMemo, useRef, useState, useCallback, useId } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useGesture } from '@use-gesture/react';
import {
  ArrowLeft, Package, GripVertical, Search, ShieldAlert, AlertTriangle, RefreshCw,
  Star, Lock, CheckCircle2, HelpCircle, Trash2, Upload, FolderOpen, Plus, X, Download, Pencil, Github,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Markdown } from '../components/Markdown';
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
import { openExternal, isInLauncher } from '../utils/externalLink';
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
  requestModUpdate,
  cancelModUpdate,
  acceptModUpdate,
  rejectModUpdate,
  type CatalogMod,
  type CatalogModStatus,
  type SubmitModInput,
  type ModMetadataPatch,
  type PendingModUpdate,
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
  /** True when the catalog's published version is newer than what's installed on disk. */
  updateAvailable: boolean;
  /** True when what's installed on disk (e.g. sideloaded) is newer than the catalog's published version. */
  localVersionAhead: boolean;
}

type InstalledFilter = 'all' | 'installed' | 'not-installed';
type StatusFilter = 'all' | CatalogModStatus;

/** Derives a slug from free text loosely matching the launcher's `sanitize_mod_id`: alphanumeric/-/_/. kept, else `_`. */
function sanitizeModId(input: string): string {
  return input.replace(/[^a-zA-Z0-9\-_.]/g, '_');
}

/** Parses a mod version string (optionally `v`-prefixed) into a `[major, minor, patch]` triple, defaulting unparsed parts to 0. */
function parseModVersion(version: string): [number, number, number] {
  const cleaned = version.trim().replace(/^v/i, '');
  const parts = cleaned.split('.').map(p => parseInt(p, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** True when `catalogVersion` is strictly newer than `installedVersion` by semver comparison. */
function isNewerModVersion(catalogVersion: string, installedVersion: string): boolean {
  const [cMaj, cMin, cPat] = parseModVersion(catalogVersion);
  const [iMaj, iMin, iPat] = parseModVersion(installedVersion);
  if (cMaj !== iMaj) return cMaj > iMaj;
  if (cMin !== iMin) return cMin > iMin;
  return cPat > iPat;
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
  /** Minimum game version this mod requires, e.g. "1.2.0" or "v1.2.0" (optional). */
  gameVersion: string;
}

function emptyModMetaState(): ModMetaState {
  return { name: '', author: '', description: '', version: '', iconUrl: '', requires: [], screenshotsText: '', videosText: '', gameVersion: '' };
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
    gameVersion: cm.gameVersion ?? '',
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
          <label className="text-xs" style={labelStyle}>Mod version</label>
          <input value={state.version} onChange={e => onChange({ ...state, version: e.target.value })} placeholder="1.0.0" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs" style={labelStyle}>
            Game version <span className="opacity-70">(optional)</span>
          </label>
          <input value={state.gameVersion} onChange={e => onChange({ ...state, gameVersion: e.target.value })} placeholder="1.3.0" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
        </div>
      </div>
      <div>
        <label className="text-xs" style={labelStyle}>Icon URL</label>
        <input value={state.iconUrl} onChange={e => onChange({ ...state, iconUrl: e.target.value })} placeholder="https://..." className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={inputStyle} />
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
  const { recompName, modId: urlModId } = useParams<{ recompName: string; modId?: string }>();
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  // Local mod management (sideload, mods folder, installed/not-installed
  // state) only exists inside a launcher that ships the mods bridge — in the
  // plain web build the page is a read-only catalog browser.
  const canManageMods = isLauncherVersionAtLeast('1.7.0');

  const [search, setSearch] = useState('');
  const [installedFilter, setInstalledFilter] = useState<InstalledFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [focusedModId, setFocusedModId] = useState<string | null>(urlModId ?? null);
  const [confirmRemove, setConfirmRemove] = useState<ModInfo | null>(null);
  const [confirmReject, setConfirmReject] = useState<CatalogMod | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [editingMod, setEditingMod] = useState<CatalogMod | null>(null);
  const [requestingUpdateFor, setRequestingUpdateFor] = useState<CatalogMod | null>(null);
  const [reviewingUpdate, setReviewingUpdate] = useState<CatalogMod | null>(null);

  // Select a mod and update the URL so it's shareable / back-button-friendly.
  const selectMod = useCallback((key: string | null) => {
    setFocusedModId(key);
    const base = `/${recompName}/mods`;
    navigate(key ? `${base}/${key}` : base, { replace: true });
  }, [recompName, navigate]);

  // Sync focusedModId when the user navigates with back/forward
  useEffect(() => {
    if (urlModId !== undefined) setFocusedModId(urlModId);
  }, [urlModId]);

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
      const updateAvailable = !!installed && !!cm.version && !!installed.version && isNewerModVersion(cm.version, installed.version);
      const localVersionAhead = !!installed && !!cm.version && !!installed.version && isNewerModVersion(installed.version, cm.version);
      result.push({ key: cm.modId, catalogMod: cm, installed, isInstalled: !!installed, updateAvailable, localVersionAhead });
    }

    for (const im of installedMods ?? []) {
      if (usedInstalledIds.has(im.id)) continue;
      result.push({ key: im.id, installed: im, isInstalled: true, updateAvailable: false, localVersionAhead: false });
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

  // Installed mods form one contiguous, drag-reorderable block so dragging
  // never has to hop over uninstalled rows: required/featured-but-uninstalled
  // mods stay pinned above it (so they're still noticed), and everything else
  // uninstalled sinks below it.
  const rowGroup = useCallback((row: ModRow): 0 | 1 | 2 => {
    if (row.isInstalled) return 1;
    const status = row.catalogMod?.status;
    return status === 'required' || status === 'featured' ? 0 : 2;
  }, []);

  const sortedRows = useMemo(() => {
    const installedOrder = new Map((installedMods ?? []).map((m, i) => [m.id, i]));
    return [...filteredRows].sort((a, b) => {
      const ga = rowGroup(a);
      const gb = rowGroup(b);
      if (ga !== gb) return ga - gb;
      if (ga === 1) {
        const oa = a.installed ? installedOrder.get(a.installed.id) ?? 0 : 0;
        const ob = b.installed ? installedOrder.get(b.installed.id) ?? 0 : 0;
        return oa - ob;
      }
      const sa = a.catalogMod ? STATUS_ORDER[a.catalogMod.status] : 4;
      const sb = b.catalogMod ? STATUS_ORDER[b.catalogMod.status] : 4;
      return sa - sb;
    });
  }, [filteredRows, installedMods, rowGroup]);

  const showDragHandles = canManageMods;

  // Auto-select the first mod in the list when the page loads or filters change
  useEffect(() => {
    if (!focusedModId && sortedRows.length > 0) {
      selectMod(sortedRows[0].key);
    }
  }, [sortedRows, focusedModId]);

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
      {!lightboxOpen && (
        <div
          className="h-16 border-b flex items-center px-6 gap-4 relative z-20 shrink-0"
          style={{ backgroundColor: 'var(--theme-topbar-bg)', borderColor: 'var(--theme-border)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}
        >
          <button
            type="button"
            onClick={() => navigate(`/library/${game.recompName}`)}
          >
            <Button variant="ghost" size="icon" className="shrink-0 hover:bg-[var(--theme-item-selected)]" style={{ color: 'var(--theme-text-primary)' }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </button>
          <h1 className="text-xl font-bold truncate flex-1 min-w-0" style={{ color: 'var(--theme-text-primary)' }}>
            Mods for {game.title}
          </h1>
          <Button
            size="sm"
            className="shrink-0 bg-[#1a6bc4] hover:bg-[#2080e0] text-white"
            onClick={() => (user ? setShowSubmitModal(true) : navigate('/login'))}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Submit a mod
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative z-10">
        <div className="h-full flex gap-4 p-4 md:p-6">
          {/* Left column: merged mod list. On phones the page is a two-step
              flow — list, then detail — so the list hides while a mod is
              focused and the detail panel takes over; ≥md they sit side by side. */}
          <div className={`w-full md:w-1/3 min-w-[260px] flex-col gap-3 overflow-hidden ${focusedRow ? 'hidden md:flex' : 'flex'}`}>
            {hasEnabledCodeMod && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs border shrink-0" style={{ backgroundColor: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.4)', color: '#fdba74' }}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Mods can run arbitrary code on your PC. Only install mods from people you trust.</span>
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

            {canManageMods && (
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
            )}
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

            {canManageMods && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={handleOpenFolder} title="Open mods folder" style={{ color: 'var(--theme-text-primary)' }}>
                <FolderOpen className="w-4 h-4" />
              </Button>
              <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleBrowse} disabled={installing}>
                <Upload className="w-3 h-3 mr-1" /> Sideload...
              </Button>
            </div>
            )}

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
                const version = row.installed?.version || row.catalogMod?.version;
                const author = row.catalogMod?.author ?? row.installed?.author;
                const icon = row.installed?.icon || row.catalogMod?.iconUrl;
                const isDragging = dragId === row.installed?.id;
                const isFocused = focusedModId === row.key;
                return (
                  <div
                    key={row.key}
                    data-mod-id={row.installed?.id ?? row.key}
                    onClick={() => selectMod(row.key)}
                    className="flex items-center gap-3 p-3 rounded-lg select-none cursor-pointer"
                    style={{
                      backgroundColor: isFocused ? 'var(--theme-item-selected)' : 'var(--theme-item-default)',
                      opacity: row.installed && !row.installed.enabled ? 0.5 : (isDragging ? 0.6 : 1),
                      borderTop: isFocused ? '1px solid var(--theme-accent)' : status === 'unapproved' ? '1px dashed rgba(148,163,184,0.6)' : '1px solid transparent',
                      borderRight: isFocused ? '1px solid var(--theme-accent)' : status === 'unapproved' ? '1px dashed rgba(148,163,184,0.6)' : '1px solid transparent',
                      borderBottom: isFocused ? '1px solid var(--theme-accent)' : status === 'unapproved' ? '1px dashed rgba(148,163,184,0.6)' : '1px solid transparent',
                      borderLeft: status === 'featured' ? '3px solid #facc15' : isFocused ? '1px solid var(--theme-accent)' : status === 'unapproved' ? '1px dashed rgba(148,163,184,0.6)' : '1px solid transparent',
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
                        {status && status !== 'approved' && status !== 'featured' ? <StatusBadge status={status} /> : !row.catalogMod && row.installed && <SideloadBadge />}
                        <p className="text-base font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
                          {name}{version && <span className="font-normal ml-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>v{version}</span>}
                        </p>
                        {row.updateAvailable && (
                          <span
                            className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: 'rgba(96,165,250,0.18)', color: '#60a5fa' }}
                            title={`Update available: v${row.catalogMod?.version}`}
                          >
                            <Download className="w-3 h-3" /> Update
                          </span>
                        )}
                        {row.localVersionAhead && (
                          <span
                            className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: 'rgba(74,222,128,0.18)', color: '#4ade80' }}
                            title={`Installed v${row.installed?.version} is newer than the catalog's published v${row.catalogMod?.version}`}
                          >
                            Ahead of catalog
                          </span>
                        )}
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
                    ) : canManageMods ? (
                      <span className="text-xs shrink-0" style={{ color: 'var(--theme-text-muted)' }}>Not installed</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: focused mod detail panel (step 2 of the mobile flow) */}
          <div className={`${focusedRow ? 'flex' : 'hidden'} md:flex flex-1 overflow-y-auto rounded-lg p-4 md:p-6`} style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            {focusedRow ? (
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => selectMod(null)}
                  className="md:hidden flex items-center gap-1 text-sm mb-3"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  <ArrowLeft className="w-4 h-4" /> All mods
                </button>
                <ModDetailPanel
                row={focusedRow}
                recompName={recompName}
                privileged={privileged}
                currentUserUid={user?.uid}
                allCatalogMods={catalogMods}
                installedMods={installedMods}
                onRemove={(mod) => setConfirmRemove(mod)}
                onToggleEnabled={toggleEnabled}
                onFetchMods={installedHook.fetchMods}
                onReject={(cm) => setConfirmReject(cm)}
                onEdit={(cm) => setEditingMod(cm)}
                onRequestUpdate={(cm) => setRequestingUpdateFor(cm)}
                onCancelUpdate={(cm) => cancelModUpdate(cm.id)}
                onReviewUpdate={(cm) => setReviewingUpdate(cm)}
                onFocusMod={(key) => {
                  // A required/conflicting mod might be filtered out of view
                  // (status filter, installed-only, or a stale search) —
                  // clear those so the row we're jumping to is guaranteed visible.
                  setStatusFilter('all');
                  setInstalledFilter('all');
                  setSearch('');
                  selectMod(key);
                  requestAnimationFrame(() => {
                    listRef.current?.querySelector(`[data-mod-id="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
                  });
                }}
                onLightboxChange={setLightboxOpen}
                />
              </div>
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
        title={confirmReject?.status === 'unapproved' ? 'Reject submission?' : 'Delete mod?'}
        description={
          confirmReject?.status === 'unapproved'
            ? `Reject and delete "${confirmReject?.name ?? ''}"? This can't be undone.`
            : `Delete "${confirmReject?.name ?? ''}" from the catalog? This can't be undone.`
        }
        confirmLabel={confirmReject?.status === 'unapproved' ? 'Reject' : 'Delete'}
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

      {requestingUpdateFor && user && (
        <RequestModUpdateModal
          mod={requestingUpdateFor}
          userUid={user.uid}
          userName={user.username ?? user.email ?? 'Unknown'}
          onClose={() => setRequestingUpdateFor(null)}
        />
      )}

      {reviewingUpdate && (
        <ReviewUpdateModal
          mod={reviewingUpdate}
          onClose={() => setReviewingUpdate(null)}
          onAccept={(cm, checksum) => acceptModUpdate(cm, checksum)}
          onReject={(cm) => rejectModUpdate(cm.id)}
        />
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

/**
 * Re-downloads `assetUrl` and hashes it via the launcher's `computeModChecksum`
 * bridge call, for stamping onto a catalog entry at approve/accept-update
 * time (see `CatalogMod.checksum`). Resolves to `undefined` (rather than
 * throwing) when the asset has no URL yet, the running launcher predates
 * `computeModChecksum`, or the call fails — callers fall back to approving
 * without a checksum rather than blocking moderation on it.
 */
function computeChecksumIfAvailable(assetUrl: string | undefined): string | undefined {
  if (!assetUrl) return undefined;
  const w = window as any;
  if (typeof w.computeModChecksum !== 'function') return undefined;
  try {
    const result = w.computeModChecksum(assetUrl);
    return typeof result?.checksum === 'string' ? result.checksum : undefined;
  } catch {
    return undefined;
  }
}

type MediaSlide =
  | { kind: 'video'; videoId: string }
  | { kind: 'image'; url: string };

function buildMediaSlides(cm: CatalogMod | undefined): MediaSlide[] {
  if (!cm) return [];
  const slides: MediaSlide[] = [];
  for (const url of cm.videoUrls ?? []) {
    const id = youtubeVideoId(url);
    if (id) slides.push({ kind: 'video', videoId: id });
  }
  for (const url of cm.screenshots ?? []) {
    slides.push({ kind: 'image', url });
  }
  return slides;
}

/** Singleton promise that loads the YouTube IFrame API script exactly once. */
let ytApiPromise: Promise<void> | null = null;
function ensureYtApi(): Promise<void> {
  if (!ytApiPromise) {
    ytApiPromise = new Promise<void>((resolve) => {
      if ((window as any).YT?.Player) { resolve(); return; }
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      (window as any).onYouTubeIframeAPIReady = () => resolve();
      document.head.appendChild(tag);
    });
  }
  return ytApiPromise;
}

function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const gestureActive = useRef(false);
  const dragMoved = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const applyTransform = useCallback((scale: number, x: number, y: number) => {
    if (imgRef.current) {
      imgRef.current.style.transform = scale !== 1 ? `translate(${x}px, ${y}px) scale(${scale})` : '';
    }
  }, []);

  const zoomTo = useCallback((target: number) => {
    const clamped = Math.min(Math.max(target, 1), 5);
    scaleRef.current = clamped;
    if (clamped === 1) offsetRef.current = { x: 0, y: 0 };
    applyTransform(clamped, offsetRef.current.x, offsetRef.current.y);
  }, [applyTransform]);

  const bind = useGesture({
    onPinch: ({ offset: [s], first }) => {
      if (first) gestureActive.current = true;
      zoomTo(s);
    },
    onDragStart: () => { dragMoved.current = false; },
    onDrag: ({ offset: [dx, dy] }) => {
      if (!dragMoved.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragMoved.current = true;
      }
      if (dragMoved.current && scaleRef.current > 1) {
        gestureActive.current = true;
        offsetRef.current = { x: dx, y: dy };
        applyTransform(scaleRef.current, dx, dy);
      }
    },
    onDragEnd: () => {
      if (!dragMoved.current) {
        zoomTo(scaleRef.current > 1 ? 1 : 2);
      }
      setTimeout(() => { gestureActive.current = false; }, 0);
    },
    onPinchEnd: () => { setTimeout(() => { gestureActive.current = false; }, 0); },
  }, {
    drag: {
      from: () => [offsetRef.current.x, offsetRef.current.y],
    },
    pinch: {
      scaleBounds: { min: 1, max: 5 },
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onWheel={(e) => {
        e.preventDefault();
        if (e.deltaY < 0 && scaleRef.current === 1) zoomTo(2);
        else if (e.deltaY > 0 && scaleRef.current > 1) zoomTo(1);
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm z-10 hover:scale-110 transition-transform"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <img
        ref={imgRef}
        src={url}
        alt=""
        className="select-none"
        style={{
          maxWidth: scaleRef.current > 1 ? 'none' : '90vw',
          maxHeight: scaleRef.current > 1 ? 'none' : '90vh',
          cursor: scaleRef.current > 1 ? 'grab' : 'zoom-in',
          touchAction: 'none',
        }}
        draggable={false}
        {...bind()}
      />

      {scaleRef.current > 1 && (
        <span
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded-full backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
        >
          tap to zoom out · drag to pan
        </span>
      )}
    </div>
  );
}

function MediaCarousel({ slides, modName, onLightboxChange }: { slides: MediaSlide[]; modName: string; onLightboxChange: (open: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [remountTickers, setRemountTickers] = useState<Record<number, number>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(0);
  const iframeRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());
  const playersRef = useRef<Map<number, any>>(new Map());
  const safeIndex = Math.min(index, Math.max(slides.length - 1, 0));

  useEffect(() => { setIndex(0); setRemountTickers({}); prevIndexRef.current = 0; }, [slides.length]);

  const openLightbox = useCallback((url: string) => {
    setLightboxUrl(url);
    onLightboxChange(true);
  }, [onLightboxChange]);

  const closeLightbox = useCallback(() => {
    setLightboxUrl(null);
    onLightboxChange(false);
  }, [onLightboxChange]);

  // When the active slide changes, force-remount any video we're leaving so it stops playing.
  // Delay until after the scroll transition finishes so the old video stays visible during the slide.
  useEffect(() => {
    const prevIndex = prevIndexRef.current;
    if (prevIndex !== safeIndex && slides[prevIndex]?.kind === 'video') {
      const timer = setTimeout(() => {
        setRemountTickers(prev => ({ ...prev, [prevIndex]: (prev[prevIndex] ?? 0) + 1 }));
      }, 400);
      prevIndexRef.current = safeIndex;
      return () => clearTimeout(timer);
    }
    prevIndexRef.current = safeIndex;
  }, [safeIndex, slides]);

  // Auto-advance screenshots after 7 seconds (videos auto-advance via YT API)
  useEffect(() => {
    const slide = slides[safeIndex];
    if (!slide || slide.kind !== 'image') return;
    if (slides.length <= 1) return;
    const timer = setTimeout(() => {
      setIndex(prev => {
        const n = (prev + 1) % slides.length;
        if (n < prev) didWrapRef.current = true;
        return n;
      });
    }, 7000);
    return () => clearTimeout(timer);
  }, [safeIndex, slides]);

  // Destroy all YT.Player instances when iframes get remounted
  useEffect(() => {
    for (const [, player] of playersRef.current) {
      try { player.destroy?.(); } catch { /* already gone */ }
    }
    playersRef.current.clear();
  }, [remountTickers]);

  // Create YT.Player instances and wire up onStateChange for auto-advance
  useEffect(() => {
    let cancelled = false;
    ensureYtApi().then(() => {
      if (cancelled) return;
      slides.forEach((slide, i) => {
        if (slide.kind !== 'video' || playersRef.current.has(i)) return;
        const iframe = iframeRefs.current.get(i);
        if (!iframe) return;
        try {
          const player = new (window as any).YT.Player(iframe, {
            events: {
              onStateChange: (event: any) => {
                if (!cancelled && event.data === 0) {
                  setIndex(prev => {
                    const n = (prev + 1) % slides.length;
                    if (n < prev) didWrapRef.current = true;
                    return n;
                  });
                }
              },
            },
          });
          playersRef.current.set(i, player);
        } catch { /* iframe not ready yet */ }
      });
    });
    return () => { cancelled = true; };
  }, [slides, remountTickers]);

  // Clean up all players on unmount
  useEffect(() => {
    return () => {
      for (const [, player] of playersRef.current) {
        try { player.destroy?.(); } catch { /* already gone */ }
      }
      playersRef.current.clear();
    };
  }, []);

  const prev = useCallback(() => setIndex(i => {
    const next = (i - 1 + slides.length) % slides.length;
    if (next > i) didWrapRef.current = true;
    return next;
  }), [slides.length]);
  const next = useCallback(() => setIndex(i => {
    const n = (i + 1) % slides.length;
    if (n < i) didWrapRef.current = true;
    return n;
  }), [slides.length]);

  // Keyboard navigation when the carousel is focused
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIndex(i => { const n = (i - 1 + slides.length) % slides.length; if (n > i) didWrapRef.current = true; return n; });
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIndex(i => { const n = (i + 1) % slides.length; if (n < i) didWrapRef.current = true; return n; });
    }
  }, [slides.length]);

  // When the index wraps around, instantly jump the scroll position instead of
  // smooth-scrolling through every intermediate slide.
  const didWrapRef = useRef(false);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[safeIndex] as HTMLElement | undefined;
    if (!child) return;
    if (didWrapRef.current) {
      track.scrollLeft = child.offsetLeft;
      didWrapRef.current = false;
    } else {
      child.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  }, [safeIndex]);

  if (slides.length === 0) return null;

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden select-none"
      role="region"
      aria-label="Media"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Main viewport */}
      <div className="relative aspect-video w-full overflow-hidden" style={{ backgroundColor: '#000' }}>
        {/* Slides track — a single row of full-width slides */}
        <div ref={trackRef} className="flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          {slides.map((slide, i) => (
            <div key={i} className="w-full h-full shrink-0 snap-center flex items-center justify-center" style={{ backgroundColor: '#000' }}>
              {slide.kind === 'video' ? (
                <iframe
                  key={`vid-${i}-${remountTickers[i] ?? 0}`}
                  ref={(el) => { if (el) iframeRefs.current.set(i, el); }}
                  src={`https://www.youtube.com/embed/${slide.videoId}?rel=0&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
                  title={`${modName} video ${i + 1}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="origin-when-cross-origin"
                />
              ) : (
                <button type="button" onClick={() => openLightbox(slide.url)} className="w-full h-full flex items-center justify-center cursor-zoom-in">
                  <img src={slide.url} alt={`${modName} screenshot ${i + 1}`} className="w-full h-full object-contain" draggable={false} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Navigation arrows — only shown when there are multiple slides */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm transition-opacity"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm transition-opacity"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Slide counter badge */}
        {slides.length > 1 && (
          <span
            className="absolute bottom-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.85)' }}
          >
            {safeIndex + 1} / {slides.length}
          </span>
        )}
      </div>

      {/* Thumbnail strip — centered */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          {slides.map((slide, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className="relative shrink-0 w-16 h-10 rounded-md overflow-hidden border-2 transition-colors"
              style={{
                borderColor: i === safeIndex ? '#fff' : 'rgba(255,255,255,0.15)',
                opacity: i === safeIndex ? 1 : 0.6,
              }}
            >
              {slide.kind === 'video' ? (
                <img
                  src={`https://img.youtube.com/vi/${slide.videoId}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <img src={slide.url} alt="" className="w-full h-full object-cover" draggable={false} />
              )}
            </button>
          ))}
        </div>
      )}
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={closeLightbox} />}
    </div>
  );
}

interface ModDetailPanelProps {
  row: ModRow;
  recompName: string;
  privileged: boolean;
  /** Signed-in viewer's uid, used to offer update-request actions on mods they submitted themselves. */
  currentUserUid: string | undefined;
  allCatalogMods: CatalogMod[];
  installedMods: ModInfo[] | null;
  onRemove: (mod: ModInfo) => void;
  onToggleEnabled: (id: string) => void;
  onFetchMods: () => void;
  onReject: (cm: CatalogMod) => void;
  onEdit: (cm: CatalogMod) => void;
  onRequestUpdate: (cm: CatalogMod) => void;
  onCancelUpdate: (cm: CatalogMod) => void;
  onReviewUpdate: (cm: CatalogMod) => void;
  onFocusMod: (key: string) => void;
  onLightboxChange: (open: boolean) => void;
}

function ModDetailPanel({ row, recompName, privileged, currentUserUid, allCatalogMods, installedMods, onRemove, onToggleEnabled, onFetchMods, onReject, onEdit, onRequestUpdate, onCancelUpdate, onReviewUpdate, onFocusMod, onLightboxChange }: ModDetailPanelProps) {
  const { catalogMod: cm, installed, isInstalled } = row;
  const [installingUrl, setInstallingUrl] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  const name = cm?.name ?? installed?.name ?? row.key;
  const version = installed?.version || cm?.version;
  const author = cm?.author ?? installed?.author;
  const description = cm?.description ?? installed?.description;
  const requires = installed?.requires ?? cm?.requires ?? [];
  const conflicts = installed?.conflicts ?? [];
  const platform = installed?.platform ?? cm?.platform ?? [];
  const gameVersion = installed?.game_version || cm?.gameVersion;
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
        w.installModFromUrl(recompName, reqMod.assetUrl, reqMod.modId, reqMod.checksum);
        await waitForInstallToFinish(w);
      }

      w.installModFromUrl(recompName, cm.assetUrl, cm.modId, cm.checksum);
      await waitForInstallToFinish(w);
    } finally {
      setInstallingUrl(false);
      onFetchMods();
    }
  }, [cm, recompName, onFetchMods, installedMods, allCatalogMods]);

  // Approving (or accepting an update to) a mod always publishes/changes its
  // release asset, so a checksum for that exact asset must be computable
  // before the write — `approveMod`/`acceptModUpdate` also enforce this, but
  // checking here first lets us show a clear error instead of a thrown one.
  const handleApprove = useCallback(() => {
    if (!cm) return;
    const checksum = computeChecksumIfAvailable(cm.assetUrl);
    if (!checksum) {
      setModerationError('Could not compute a checksum for this release (update your launcher, or check the asset URL). Approval requires one.');
      return;
    }
    setModerationError(null);
    approveMod(cm.id, '', checksum);
  }, [cm]);

  const handleReview = useCallback(() => {
    if (!cm) return;
    onReviewUpdate(cm);
  }, [cm, onReviewUpdate]);

  const mediaSlides = buildMediaSlides(cm);

  return (
    <div className="w-full space-y-5 pb-6">
      {/* Header: icon + name + version + author */}
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 w-16 h-16 flex items-center justify-center overflow-hidden rounded-lg shadow-md"
          style={icon ? undefined : { backgroundColor: 'var(--theme-item-default)' }}
        >
          {icon ? <img src={icon} alt="" className="w-16 h-16 object-cover" /> : <Package className="w-6 h-6" style={{ color: 'var(--theme-text-muted)' }} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {cm ? <StatusBadge status={cm.status} /> : installed && <SideloadBadge />}
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--theme-text-primary)' }}>{name}</h2>
            {version && <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>v{version}</span>}
            {row.localVersionAhead && (
              <span
                className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(74,222,128,0.18)', color: '#4ade80' }}
                title={`The installed version is newer than the catalog's published v${cm?.version}`}
              >
                Ahead of catalog
              </span>
            )}
          </div>
          {author && <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>by {author}</p>}
          {privileged && cm?.submittedByName && <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Submitted by {cm.submittedByName}</p>}
        </div>
      </div>

      {/* Media carousel: YouTube videos first, then screenshots */}
      {mediaSlides.length > 0 && (
        <MediaCarousel slides={mediaSlides} modName={name} onLightboxChange={onLightboxChange} />
      )}

      {/* Description */}
      {description && (
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--theme-item-default)', color: 'var(--theme-text-secondary)' }}>
          <Markdown source={description} className="text-sm leading-relaxed" />
        </div>
      )}

      {/* Metadata: requirements, conflicts, platform, source */}
      <div className="text-xs space-y-1" style={{ color: 'var(--theme-text-muted)' }}>
        {gameVersion && <p>Requires game v{gameVersion}</p>}
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
        {cm?.githubRepo && (
          <p className="flex items-center gap-1">
            Source:{' '}
            <button
              type="button"
              onClick={() => openExternal(`https://github.com/${cm.githubRepo}`)}
              className="inline-flex items-center gap-1 text-xs underline"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              <Github className="w-5 h-5" /> {cm.githubRepo}
            </button>
          </p>
        )}
      </div>

      {/* Moderation error */}
      {moderationError && <p className="text-xs text-red-300">{moderationError}</p>}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
        {!isInstalled && cm?.assetUrl && canInstallFromUrl && (
          <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleInstall} disabled={installingUrl}>
            <Download className="w-3.5 h-3.5 mr-1" /> {installingUrl ? 'Installing...' : 'Install'}
          </Button>
        )}
        {!isInstalled && cm && !cm.assetUrl && (
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>No asset resolved yet.</p>
        )}
        {!isInLauncher() && cm?.assetUrl && (
          <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => openExternal(cm.assetUrl!)} style={{ color: 'var(--theme-text-primary)' }}>
            <Download className="w-3.5 h-3.5 mr-1" /> Download ZIP
          </Button>
        )}
        {row.updateAvailable && cm?.assetUrl && canInstallFromUrl && (
          <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleInstall} disabled={installingUrl}>
            <Download className="w-3.5 h-3.5 mr-1" /> {installingUrl ? 'Updating...' : `Update to v${cm.version}`}
          </Button>
        )}
        {installed && (
          <>
            <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => onToggleEnabled(installed.id)} style={{ color: 'var(--theme-text-primary)' }}>
              {installed.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => onRemove(installed)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
            </Button>
          </>
        )}

        {privileged && cm && cm.pendingUpdate && (
          <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleReview}>
            Review (v{cm.pendingUpdate.version})
          </Button>
        )}

        {!privileged && cm && currentUserUid && cm.submittedBy === currentUserUid && (
          <>
            {cm.pendingUpdate ? (
              <>
                <span className="text-xs self-center" style={{ color: 'var(--theme-text-muted)' }}>
                  Update to v{cm.pendingUpdate.version} pending review
                </span>
                <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => onRequestUpdate(cm)} style={{ color: 'var(--theme-text-primary)' }}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit request
                </Button>
                <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => onCancelUpdate(cm)} style={{ color: 'var(--theme-text-primary)' }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel request
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => onRequestUpdate(cm)} style={{ color: 'var(--theme-text-primary)' }}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Request update
              </Button>
            )}
          </>
        )}

        {privileged && cm && (
          <>
            <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => onEdit(cm)} style={{ color: 'var(--theme-text-primary)' }}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
            {cm.status === 'unapproved' && (
              <>
                <Button size="sm" className="bg-green-700 hover:bg-green-600 text-white" onClick={handleApprove}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => onReject(cm)}>
                  <X className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </>
            )}
            {cm.status === 'approved' && (
              <>
                <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => featureMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                  <Star className="w-3.5 h-3.5 mr-1" /> Feature
                </Button>
                <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => requireMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                  <Lock className="w-3.5 h-3.5 mr-1" /> Require
                </Button>
              </>
            )}
            {cm.status === 'featured' && (
              <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => unfeatureMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                <Star className="w-3.5 h-3.5 mr-1" /> Unfeature
              </Button>
            )}
            {cm.status === 'required' && (
              <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={() => unrequireMod(cm.id)} style={{ color: 'var(--theme-text-primary)' }}>
                <Lock className="w-3.5 h-3.5 mr-1" /> Unrequire
              </Button>
            )}
            {cm.status !== 'unapproved' && (
              <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => onReject(cm)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const modInputStyle = { backgroundColor: 'var(--theme-item-default)', color: 'var(--theme-text-primary)' };
const modLabelStyle = { color: 'var(--theme-text-muted)' };

interface ModDialogProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

/** Shared dialog scaffold for the Submit/Edit/Request-update mod modals. */
function ModDialog({ title, onClose, children }: ModDialogProps) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

interface ReleaseFetchRowProps {
  tag: string;
  onTagChange: (v: string) => void;
  /** Omit to hide the asset-regex field (e.g. the update-request form, which is locked to the mod's existing selector). */
  assetRegex?: string;
  onAssetRegexChange?: (v: string) => void;
  onFetch: () => void;
  busy: boolean;
  resolved: ResolvedAsset | null;
  fetchLabel?: string;
  /** Label prefix for the resolved line — "Resolved" for a fresh fetch, "Pinned" once saved. */
  resolvedLabel?: string;
}

/** Shared "release tag + asset regex + Fetch from GitHub" row used by all three mod modals. */
function ReleaseFetchRow({ tag, onTagChange, assetRegex, onAssetRegexChange, onFetch, busy, resolved, fetchLabel, resolvedLabel = 'Resolved' }: ReleaseFetchRowProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs" style={modLabelStyle}>Release tag</label>
          <input value={tag} onChange={e => onTagChange(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={modInputStyle} />
        </div>
        {onAssetRegexChange && (
          <div>
            <label className="text-xs" style={modLabelStyle}>Asset regex (optional)</label>
            <input value={assetRegex} onChange={e => onAssetRegexChange(e.target.value)} placeholder="^mod_name" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={modInputStyle} />
          </div>
        )}
      </div>

      <Button size="sm" variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={onFetch} disabled={busy} style={{ color: 'var(--theme-accent)' }}>
        <RefreshCw className="w-3.5 h-3.5 mr-1" /> {fetchLabel ?? (resolved ? 'Re-fetch from GitHub' : 'Fetch from GitHub')}
      </Button>

      {resolved ? (
        <p className="text-xs" style={modLabelStyle}>{resolvedLabel}: {resolved.tag} / {resolved.assetName}</p>
      ) : (
        <p className="text-xs flex items-center gap-1" style={modLabelStyle}>
          <HelpCircle className="w-3 h-3 inline shrink-0" /> Fetch a release to resolve the download asset.
        </p>
      )}
    </>
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
      setTag(release.tag);

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
              // `fetched.icon` is a base64 data URL read from the zip's icon.png,
              // not a link — `iconUrl` expects a real hosted image URL, so it's
              // deliberately not auto-filled here; the submitter pastes one.
              requires: fetched.requires?.length ? fetched.requires.map(parseRequirementString) : undefined,
              gameVersion: fetched.game_version || undefined,
            };
            fetchedModId = fetched.folder_name ? sanitizeModId(fetched.folder_name) : (fetched.name ? sanitizeModId(fetched.name) : undefined);
            nextPlatform = fetched.platform;
          }
        } catch {
          // Fall back to whatever the user's already typed / the derived defaults below.
        }
      }

      // Id/name/author/description/version/gameVersion are overwritten with
      // whatever this fetch resolved — a "Re-fetch from GitHub" (after
      // changing the repo/tag/regex) is an explicit re-sync, so it should
      // reflect the newly-fetched release/asset, not silently keep stale
      // values from a previous fetch. Fields the fetch didn't return
      // anything for (or that aren't sourced from the fetch at all — icon,
      // requires, screenshots, videos) still only fill in when blank.
      setMeta(prev => ({
        name: fetchedMeta.name || fallbackName,
        author: fetchedMeta.author || prev.author,
        description: fetchedMeta.description || prev.description,
        version: fetchedMeta.version || release.tag,
        iconUrl: prev.iconUrl || fetchedMeta.iconUrl || '',
        requires: prev.requires.length ? prev.requires : (fetchedMeta.requires ?? []),
        screenshotsText: prev.screenshotsText,
        videosText: prev.videosText,
        gameVersion: fetchedMeta.gameVersion || prev.gameVersion,
      }));
      setModId(fetchedModId || sanitizeModId(fallbackName));
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
        gameVersion: meta.gameVersion.trim() || undefined,
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

  return (
    <ModDialog title="Submit a mod" onClose={onClose}>
      <div>
        <label className="text-xs" style={modLabelStyle}>GitHub repo (owner/repo or URL)</label>
        <input value={repoInput} onChange={e => setRepoInput(e.target.value)} placeholder="owner/repo" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={modInputStyle} />
      </div>

      <ReleaseFetchRow
        tag={tag}
        onTagChange={setTag}
        assetRegex={assetRegex}
        onAssetRegexChange={setAssetRegex}
        onFetch={handleFetch}
        busy={busy}
        resolved={resolved}
      />
      {resolved && !canAutoFetchMetadata && (
        <p className="text-xs flex items-center gap-1" style={modLabelStyle}>
          <HelpCircle className="w-3 h-3 inline shrink-0" /> Not running in the launcher — metadata wasn't auto-filled; enter it below.
        </p>
      )}

      <div>
        <label className="text-xs" style={modLabelStyle}>Mod id (unique on-disk folder name)</label>
        <input value={modId} onChange={e => setModId(sanitizeModId(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={modInputStyle} />
        {existingModIds.has(modId) && <p className="text-xs text-red-300 mt-1">This id is already taken for this game.</p>}
      </div>

      <ModMetaFieldsEditor state={meta} onChange={setMeta} />

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={onClose} style={{ color: 'var(--theme-text-primary)' }}>Cancel</Button>
        <Button className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleSubmit} disabled={busy || !resolved}>
          {busy ? 'Submitting...' : 'Submit'}
        </Button>
      </div>
    </ModDialog>
  );
}

interface EditModModalProps {
  mod: CatalogMod;
  onClose: () => void;
}

/** Privileged-only editor for an existing catalog entry's metadata — mirrors editing a game's details, using the same field set as [`SubmitModModal`]'s phase 2. */
function EditModModal({ mod, onClose }: EditModModalProps) {
  const [meta, setMeta] = useState<ModMetaState>(() => modMetaStateFromCatalog(mod));
  const [tag, setTag] = useState(mod.tag ?? '');
  const [assetRegex, setAssetRegex] = useState(mod.assetRegex ?? '');
  const [platform, setPlatform] = useState<string[] | undefined>(mod.platform);
  const [resolved, setResolved] = useState<ResolvedAsset | null>(
    mod.assetName && mod.assetUrl ? { repo: mod.githubRepo, tag: mod.tag ?? '', assetName: mod.assetName, assetUrl: mod.assetUrl } : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAutoFetchMetadata = isLauncherVersionAtLeast('1.7.0') && typeof (window as any).fetchModMetadata === 'function';

  // Re-resolves the repo's release/asset (same selector the mod already
  // uses, so a multi-mod release still picks the right zip) and overwrites
  // the metadata fields below with what's in the new zip's mod.toml — unlike
  // the submit form's "only fill blanks" merge, this is an explicit re-sync
  // action, so it's expected to actually update stale fields. The resolved
  // tag is pinned on save, same as a fresh submission.
  const handleFetch = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      let releases: GameRelease[];
      try {
        releases = await fetchReleases(mod.githubRepo);
      } catch {
        setError('Could not fetch releases for that repo.');
        return;
      }

      const release = tag.trim() ? releases.find(r => r.tag === tag.trim()) : releases[0];
      if (!release) { setError('No matching release found.'); return; }

      const regex = assetRegex.trim();
      const asset = regex
        ? release.assets.find(a => { try { return new RegExp(regex).test(a.name); } catch { return false; } })
        : (mod.assetName ? release.assets.find(a => a.name === mod.assetName) : undefined)
          ?? release.assets.find(a => a.name.toLowerCase().endsWith('.zip'));
      if (!asset) { setError('No matching asset (zip) found in that release.'); return; }

      setResolved({ repo: mod.githubRepo, tag: release.tag, assetName: asset.name, assetUrl: asset.url });
      setTag(release.tag);

      if (canAutoFetchMetadata) {
        try {
          const fetched = (window as any).fetchModMetadata(asset.url);
          if (fetched) {
            setMeta(prev => ({
              ...prev,
              name: fetched.name || prev.name,
              author: fetched.author || prev.author,
              description: prev.description || fetched.description,
              version: fetched.version || release.tag,
              requires: fetched.requires?.length ? fetched.requires.map(parseRequirementString) : prev.requires,
              gameVersion: fetched.game_version || prev.gameVersion,
            }));
            setPlatform(fetched.platform);
          }
        } catch {
          // Fall back to whatever's already in the form.
        }
      } else {
        setMeta(prev => ({ ...prev, version: release.tag }));
      }
    } finally {
      setBusy(false);
    }
  }, [mod.githubRepo, mod.assetName, tag, assetRegex, canAutoFetchMetadata]);

  const handleSave = useCallback(async () => {
    setError(null);

    // Only a re-fetch (via `handleFetch`) that resolved a *different* asset
    // than the mod's current one needs a fresh checksum — a plain metadata
    // edit (description, screenshots, etc.) with the release untouched
    // shouldn't require re-resolving/re-hashing anything.
    const assetChanged = !!resolved && resolved.assetUrl !== mod.assetUrl;
    let checksum: string | undefined;
    if (assetChanged) {
      checksum = computeChecksumIfAvailable(resolved!.assetUrl);
      if (!checksum) {
        setError('Could not compute a checksum for the newly resolved release (update your launcher, or check the asset URL). Saving a changed release requires one.');
        return;
      }
    }

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
        gameVersion: meta.gameVersion.trim() || undefined,
        platform,
        ...(assetChanged
          ? { tag: resolved!.tag, assetRegex: assetRegex.trim() || undefined, assetName: resolved!.assetName, assetUrl: resolved!.assetUrl, checksum }
          : {}),
      };
      await updateModMetadata(mod.id, patch);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setBusy(false);
    }
  }, [mod.id, mod.assetUrl, meta, platform, resolved, assetRegex, onClose]);

  return (
    <ModDialog title={`Edit mod — ${mod.name}`} onClose={onClose}>
      <p className="text-xs" style={modLabelStyle}>
        Source repo: {mod.githubRepo}.
      </p>

      <ReleaseFetchRow
        tag={tag}
        onTagChange={setTag}
        assetRegex={assetRegex}
        onAssetRegexChange={setAssetRegex}
        onFetch={handleFetch}
        busy={busy}
        resolved={resolved}
        fetchLabel="Fetch from GitHub"
        resolvedLabel="Pinned"
      />

      <ModMetaFieldsEditor state={meta} onChange={setMeta} />

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={onClose} style={{ color: 'var(--theme-text-primary)' }}>Cancel</Button>
        <Button className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleSave} disabled={busy}>
          {busy ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </ModDialog>
  );
}

interface RequestModUpdateModalProps {
  mod: CatalogMod;
  userUid: string;
  userName: string;
  onClose: () => void;
}

/**
 * Lets a mod's own submitter propose a new release without touching its
 * published listing directly — approval status, name, description, etc. are
 * untouched until an admin/developer accepts the request (see
 * `acceptModUpdate`). Re-resolves the release using the mod's *existing*
 * `assetRegex`/`assetName` selector (never editable here) so a GitHub
 * release that bundles several mods' zips together still resolves to the
 * one asset this mod has always used.
 */
function RequestModUpdateModal({ mod, userUid, userName, onClose }: RequestModUpdateModalProps) {
  const pending = mod.pendingUpdate;
  const [tag, setTag] = useState(pending?.tag ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedAsset | null>(
    pending ? { repo: mod.githubRepo, tag: pending.tag ?? '', assetName: pending.assetName, assetUrl: pending.assetUrl } : null
  );
  const [version, setVersion] = useState(pending?.version ?? '');
  const [gameVersion, setGameVersion] = useState(pending?.gameVersion ?? '');

  const canAutoFetchMetadata = isLauncherVersionAtLeast('1.7.0') && typeof (window as any).fetchModMetadata === 'function';

  const handleFetch = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      let releases: GameRelease[];
      try {
        releases = await fetchReleases(mod.githubRepo);
      } catch {
        setError('Could not fetch releases for that repo.');
        return;
      }

      const release = tag.trim() ? releases.find(r => r.tag === tag.trim()) : releases[0];
      if (!release) { setError('No matching release found.'); return; }

      const regex = mod.assetRegex?.trim();
      const asset = regex
        ? release.assets.find(a => { try { return new RegExp(regex).test(a.name); } catch { return false; } })
        : (mod.assetName ? release.assets.find(a => a.name === mod.assetName) : undefined)
          ?? release.assets.find(a => a.name.toLowerCase().endsWith('.zip'));
      if (!asset) { setError('No matching asset (zip) found in that release.'); return; }

      setResolved({ repo: mod.githubRepo, tag: release.tag, assetName: asset.name, assetUrl: asset.url });
      setTag(release.tag);

      if (canAutoFetchMetadata) {
        try {
          const fetched = (window as any).fetchModMetadata(asset.url);
          if (fetched) {
            setVersion(fetched.version || release.tag);
            setGameVersion(fetched.game_version || '');
          }
        } catch {
          // Fall back to manual entry below.
        }
      } else {
        setVersion(release.tag);
      }
    } finally {
      setBusy(false);
    }
  }, [mod.githubRepo, mod.assetRegex, mod.assetName, tag, canAutoFetchMetadata]);

  const handleSubmitRequest = useCallback(async () => {
    if (!resolved) return;
    setError(null);
    setBusy(true);
    try {
      await requestModUpdate(mod.id, userUid, userName, {
        tag: resolved.tag,
        assetName: resolved.assetName,
        assetUrl: resolved.assetUrl,
        version: version.trim() || resolved.tag,
        gameVersion: gameVersion.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit update request.');
    } finally {
      setBusy(false);
    }
  }, [resolved, mod.id, userUid, userName, version, gameVersion, onClose]);

  return (
    <ModDialog title={`Request update — ${mod.name}`} onClose={onClose}>
      <p className="text-xs" style={modLabelStyle}>
        Source repo ({mod.githubRepo}) is locked. Resolve the release you want to publish and submit it for an admin/developer to accept — your current listing stays unchanged until then.
      </p>

      <ReleaseFetchRow
        tag={tag}
        onTagChange={setTag}
        onFetch={handleFetch}
        busy={busy}
        resolved={resolved}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs" style={modLabelStyle}>Mod version</label>
          <input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.1" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={modInputStyle} />
        </div>
        <div>
          <label className="text-xs" style={modLabelStyle}>
            Game version <span className="opacity-70">(optional)</span>
          </label>
          <input value={gameVersion} onChange={e => setGameVersion(e.target.value)} placeholder="1.3.0" className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={modInputStyle} />
        </div>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={onClose} style={{ color: 'var(--theme-text-primary)' }}>Cancel</Button>
        <Button className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleSubmitRequest} disabled={busy || !resolved}>
          {busy ? 'Submitting...' : pending ? 'Update request' : 'Request update'}
        </Button>
      </div>
    </ModDialog>
  );
}

interface ReviewUpdateModalProps {
  mod: CatalogMod;
  onClose: () => void;
  onAccept: (cm: CatalogMod, checksum: string) => void;
  onReject: (cm: CatalogMod) => void;
}

function ReviewUpdateModal({ mod, onClose, onAccept, onReject }: ReviewUpdateModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pending = mod.pendingUpdate;

  const handleAccept = useCallback(async () => {
    if (!pending) return;
    setError(null);
    const checksum = computeChecksumIfAvailable(pending.assetUrl);
    if (!checksum) {
      setError('Could not compute a checksum for the requested release. Accepting an update requires one.');
      return;
    }
    setBusy(true);
    try {
      onAccept(mod, checksum);
      onClose();
    } catch {
      setError('Failed to accept update.');
    } finally {
      setBusy(false);
    }
  }, [pending, mod, onAccept, onClose]);

  const handleReject = useCallback(() => {
    onReject(mod);
    onClose();
  }, [mod, onReject, onClose]);

  if (!pending) return null;

  const diffFields: { label: string; current: string | undefined; pending: string }[] = [
    { label: 'Version', current: mod.version ?? undefined, pending: pending.version },
    { label: 'Game version', current: mod.gameVersion ?? undefined, pending: pending.gameVersion ?? '' },
  ];

  return (
    <ModDialog title={`Review update — ${mod.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          Requested by {pending.requestedByName} on {new Date(pending.requestedAt).toLocaleDateString()}.
        </p>

        {diffFields.map(({ label, current, pending: pendingVal }) => (
          <div key={label}>
            <label className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{label}</label>
            <div className="mt-1 space-y-1">
              {current !== undefined && (
                <div className="px-2 py-1 rounded text-sm line-through opacity-60" style={{ backgroundColor: 'rgba(248,113,113,0.15)', color: '#fca5a5' }}>
                  {current || '(empty)'}
                </div>
              )}
              <div className="px-2 py-1 rounded text-sm" style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#86efac' }}>
                {pendingVal || '(empty)'}
              </div>
            </div>
          </div>
        ))}

        <div>
          <label className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Release</label>
          <div className="mt-1 px-2 py-1.5 rounded text-sm" style={{ backgroundColor: 'var(--theme-item-default)', color: 'var(--theme-text-secondary)' }}>
            <p>{pending.tag} / {pending.assetName}</p>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" className="hover:bg-[var(--theme-item-selected)]" onClick={onClose} style={{ color: 'var(--theme-text-primary)' }}>Cancel</Button>
        <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={handleReject} disabled={busy}>
          <X className="w-3.5 h-3.5 mr-1" /> Reject
        </Button>
        <Button size="sm" className="bg-green-700 hover:bg-green-600 text-white" onClick={handleAccept} disabled={busy}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {busy ? 'Approving...' : 'Approve'}
        </Button>
      </div>
    </ModDialog>
  );
}
