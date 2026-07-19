import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../types/game';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';
import { pickAssetPreservingTuStatus, pickAssetByDefaultBuildPreference } from '../utils/updateRequired';

export interface ReleaseAsset {
  name: string;
  url: string; // browser_download_url
  size?: number;
}

export interface GameRelease {
  tag: string;
  name: string;
  prerelease: boolean;
  publishedAt?: string;
  assets: ReleaseAsset[];
}

export interface InstalledInfo {
  version?: string;
  asset?: string;
  exePath?: string;
  /** Platform of the installed build's main executable, detected from its
   *  binary header by the launcher ("Windows" | "Linux" | "macOS"), or
   *  undefined if unknown (older installs, or detection failed). */
  platform?: string;
  /** Architecture of the installed build's main executable (e.g. "x86_64",
   *  "aarch64"), detected from its binary header, or undefined if unknown. */
  arch?: string;
}

/**
 * A single installed build, as reported by the launcher's `getInstalledBuilds`.
 * `name` is the on-disk build key (the sanitised release tag) — pass it back
 * to `Play`/`Uninstall`/`isExeUpdated`/`getInstalledVersion`/`NeedsUpdate` to
 * target this specific build.
 */
export interface InstalledBuild extends InstalledInfo {
  name: string;
}

const NIGHTLY_KEY = 'goopie:showNightlies';
const SHOW_INCOMPATIBLE_KEY = 'goopie:showIncompatibleBuilds';
const SELECTION_KEY = (gameId: string) => `goopie:gameVersion:${gameId}`;
const RELEASES_STORAGE_KEY = (repo: string) => `goopie:releases:${repo}`;
const RELEASES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedReleases {
  fetchedAt: number;
  releases: GameRelease[];
  /** True when this entry was served as a fallback after a failed fetch. */
  stale: boolean;
}

const releasesCache = new Map<string, CachedReleases>();

/**
 * Persistent (localStorage) copy of the releases cache, keyed per repo. This
 * survives page reloads, so a GitHub rate-limit (403) on a fresh load can
 * still show the last known-good releases instead of an empty list.
 */
function loadPersistedReleases(repo: string): CachedReleases | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(RELEASES_STORAGE_KEY(repo));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.releases) || typeof parsed.fetchedAt !== 'number') return null;
    return { fetchedAt: parsed.fetchedAt, releases: parsed.releases, stale: !!parsed.stale };
  } catch {
    return null;
  }
}

function savePersistedReleases(repo: string, entry: CachedReleases) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RELEASES_STORAGE_KEY(repo), JSON.stringify(entry));
  } catch { /* ignore quota errors */ }
}

/**
 * Derive `owner/repo` from any of the github fields on a Game.
 */
export function getGitHubRepo(game: Pick<Game, 'githubRepo' | 'githubReleaseUrl' | 'githubApiUrl'>): string | null {
  if (game.githubRepo && game.githubRepo.includes('/')) return game.githubRepo;
  if (game.githubReleaseUrl) {
    const m = game.githubReleaseUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/i);
    if (m) return m[1];
  }
  if (game.githubApiUrl) {
    const m = game.githubApiUrl.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Returns the preferred default asset name for a given game, falling back to
 * the release-flavoured exe and then the plain exe when present in `assets`.
 */
export function pickDefaultAsset(game: Pick<Game, 'recompName' | 'preferredAssetSuffix'>, assets: ReleaseAsset[]): string | undefined {
  if (assets.length === 0) return undefined;

  // Named exe candidates (old format, backward-compat).
  const exes = assets.filter(a => a.name.toLowerCase().endsWith('.exe'));
  const candidates = [
    game.preferredAssetSuffix && `${game.recompName}${game.preferredAssetSuffix}`,
    `${game.recompName}-windows-x64-release.exe`,
    `${game.recompName}-windows-x64.exe`,
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const hit = exes.find(a => a.name.toLowerCase() === c.toLowerCase());
    if (hit) return hit.name;
  }

  // Any exe (old format fallback).
  if (exes.length > 0) return exes[0].name;

  const zip = assets.find(a => a.name.toLowerCase().endsWith('.zip'));
  if (zip) return zip.name;
  const tgz = assets.find(a => a.name.toLowerCase().endsWith('.tar.gz'));
  if (tgz) return tgz.name;
  const sz = assets.find(a => a.name.toLowerCase().endsWith('.7z'));
  if (sz) return sz.name;

  return assets[0].name;
}

/**
 * Best-effort platform guess from a release asset's filename. This mapping is
 * intentionally *optional* — many builds don't encode the platform in their
 * name, in which case this returns `undefined` and the asset is treated as
 * compatible with every platform (never hidden, never penalised in ranking).
 */
export function detectAssetPlatform(name: string): 'Windows' | 'Linux' | 'macOS' | undefined {
  const lower = name.toLowerCase();
  if (lower.includes('windows') || lower.includes('win32') || lower.includes('win64') || lower.endsWith('.exe')) {
    return 'Windows';
  }
  if (lower.includes('macos') || lower.includes('darwin') || lower.includes('osx') || lower.endsWith('.dmg') || lower.endsWith('.pkg')) {
    return 'macOS';
  }
  if (lower.includes('linux') || lower.endsWith('.appimage')) {
    return 'Linux';
  }
  return undefined;
}

/** Architecture "family" used for cross-arch compatibility checks. */
type ArchFamily = 'x86' | 'arm' | undefined;

function normalizeArch(arch: string | undefined): { family: ArchFamily; is64: boolean } {
  switch (arch?.toLowerCase()) {
    case 'x86_64': case 'amd64': case 'x64':
      return { family: 'x86', is64: true };
    case 'x86': case 'i386': case 'i686':
      return { family: 'x86', is64: false };
    case 'aarch64': case 'arm64':
      return { family: 'arm', is64: true };
    case 'arm':
      return { family: 'arm', is64: false };
    default:
      return { family: undefined, is64: false };
  }
}

/**
 * Whether a build for `buildPlatform` can run on `hostPlatform`. An unknown
 * value on either side is treated as compatible — we only hide/grey out
 * builds we're confident won't run.
 *
 * When `protonReady` is true, Windows builds are treated as compatible on
 * Linux (the launcher routes them through Proton transparently).
 */
export function isPlatformCompatible(
  buildPlatform: string | undefined,
  hostPlatform: string | undefined,
  protonReady = false,
): boolean {
  if (!buildPlatform || !hostPlatform) return true;
  if (protonReady && hostPlatform === 'Linux' && buildPlatform === 'Windows') return true;
  return buildPlatform === hostPlatform;
}

/**
 * Whether a build for `buildArch` can run on `hostArch`. Unknown values are
 * treated as compatible. Cross-family (x86 vs arm) is incompatible; within a
 * family, a narrower build (e.g. 32-bit) runs fine on a wider (64-bit) host,
 * but not vice versa.
 */
export function isArchCompatible(buildArch: string | undefined, hostArch: string | undefined): boolean {
  if (!buildArch || !hostArch) return true;
  const build = normalizeArch(buildArch);
  const host = normalizeArch(hostArch);
  if (!build.family || !host.family) return true;
  if (build.family !== host.family) return false;
  return !build.is64 || host.is64;
}

/**
 * Returns a stable-sorted copy of `assets` with platform-appropriate artifacts
 * first. All assets are preserved — nothing is filtered out.
 */
export function sortAssetsByRelevance(assets: ReleaseAsset[], platform?: string, arch?: string): ReleaseAsset[] {
  const isWindows = !platform || platform === 'Windows';
  const isLinux = platform === 'Linux';
  const isMac = platform === 'macOS';
  const isArm = arch === 'arm64' || arch === 'aarch64';
  const isX64 = arch === 'x86_64' || arch === 'amd64' || arch === 'x64';

  const rank = (a: ReleaseAsset): number => {
    const name = a.name.toLowerCase();
    let score = 0;

    const assetPlatform = detectAssetPlatform(a.name);
    if (isWindows && assetPlatform === 'Windows') score -= 10;
    if (isLinux && assetPlatform === 'Linux') score -= 10;
    if (isMac && assetPlatform === 'macOS') score -= 10;

    if (isWindows) {
      if (name.endsWith('.exe')) score -= 5;
      if (name.endsWith('.zip')) score -= 2;
    }
    if (isLinux) {
      if (!name.includes('.')) score -= 5;
      if (name.endsWith('.tar.gz')) score -= 2;
    }
    if (isMac) {
      if (name.endsWith('.dmg') || name.endsWith('.pkg')) score -= 5;
    }
    if (isArm) {
      if (name.includes('aarch64') || name.includes('arm64') || name.includes('arm')) score -= 8;
    }
    if (isX64) {
      if (name.includes('x86_64') || name.includes('amd64') || name.includes('x64')) score -= 8;
    }

    return score;
  };

  return [...assets].sort((a, b) => rank(a) - rank(b));
}

/**
 * Parse a version tag into a numeric tuple for comparison.
 * Strips common prefixes ("v", "V") and suffix labels ("-alpha", "-rc1", etc.).
 * Returns [major, minor, patch] as numbers, defaulting to 0 for missing parts.
 */
function parseVersion(tag: string): [number, number, number] {
  const clean = tag.replace(/^[vV]/, '').split(/[-+]/)[0];
  const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Compare two release tags newest-first (descending).
 * Falls back to publishedAt when the parsed versions are equal.
 */
export function compareReleasesNewestFirst(
  a: Pick<GameRelease, 'tag' | 'publishedAt'>,
  b: Pick<GameRelease, 'tag' | 'publishedAt'>,
): number {
  const [aMaj, aMin, aPat] = parseVersion(a.tag);
  const [bMaj, bMin, bPat] = parseVersion(b.tag);
  if (bMaj !== aMaj) return bMaj - aMaj;
  if (bMin !== aMin) return bMin - aMin;
  if (bPat !== aPat) return bPat - aPat;
  // Versions identical — fall back to publish timestamp.
  const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
  const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
  return bDate - aDate;
}

/**
 * Build the canonical download URL prefix passed to the launcher's `Update`
 * function for a given release tag (the launcher appends the asset name).
 */
export function buildReleaseDownloadPrefix(repo: string, tag: string): string {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/`;
}

/**
 * Fetch and parse all non-draft releases for a GitHub repo, sorted
 * newest-first by semver.  Results are cached in-memory and persisted to
 * localStorage (with a `fetchedAt` timestamp) for RELEASES_CACHE_TTL_MS.
 *
 * GitHub's unauthenticated API rate-limits aggressively (HTTP 403). When a
 * fetch fails, this falls back to the last known-good cache (in-memory or
 * persisted) instead of throwing, so callers don't lose previously-shown
 * releases — the fallback entry is marked `stale: true` so the UI can warn
 * that the data may be outdated. Only throws when there's no cache at all.
 */
export async function fetchReleases(repo: string, force = false): Promise<GameRelease[]> {
  const cached = releasesCache.get(repo) ?? loadPersistedReleases(repo);
  if (!force && cached && !cached.stale && Date.now() - cached.fetchedAt < RELEASES_CACHE_TTL_MS) {
    releasesCache.set(repo, cached);
    return [...cached.releases].sort(compareReleasesNewestFirst);
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, {
      headers: { 'Accept': 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data: any[] = await res.json();
    const list: GameRelease[] = (Array.isArray(data) ? data : [])
      .filter(r => !r.draft)
      .map(r => ({
        tag: String(r.tag_name ?? ''),
        name: String(r.name ?? r.tag_name ?? ''),
        prerelease: !!r.prerelease,
        publishedAt: r.published_at ?? r.created_at,
        assets: Array.isArray(r.assets)
          ? r.assets
              // `.toml` files are launcher config sidecars published alongside
              // the executable, not runnable builds — never list them.
              .filter((a: any) => !String(a.name ?? '').toLowerCase().endsWith('.toml'))
              .map((a: any) => ({
                name: String(a.name ?? ''),
                url: String(a.browser_download_url ?? ''),
                size: typeof a.size === 'number' ? a.size : undefined,
              }))
          : [],
      }))
      .filter(r => r.tag)
      .sort(compareReleasesNewestFirst);
    const entry: CachedReleases = { fetchedAt: Date.now(), releases: list, stale: false };
    releasesCache.set(repo, entry);
    savePersistedReleases(repo, entry);
    return list;
  } catch (e) {
    const fallback = cached ?? loadPersistedReleases(repo);
    if (fallback) {
      const staleEntry: CachedReleases = { ...fallback, stale: true };
      releasesCache.set(repo, staleEntry);
      return [...fallback.releases].sort(compareReleasesNewestFirst);
    }
    throw e;
  }
}

/**
 * Peek at the in-memory cache metadata for a repo without triggering a fetch.
 * Lets callers (e.g. `useGameReleases`) learn when the data they just
 * received was actually fetched, and whether it's a stale fallback.
 */
export function getReleasesCacheInfo(repo: string): { fetchedAt: number; stale: boolean } | null {
  const c = releasesCache.get(repo);
  return c ? { fetchedAt: c.fetchedAt, stale: c.stale } : null;
}

export function getShowNightlies(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(NIGHTLY_KEY) === '1';
}

export function setShowNightliesPersisted(v: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NIGHTLY_KEY, v ? '1' : '0');
}

export function getShowIncompatible(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SHOW_INCOMPATIBLE_KEY) === '1';
}

export function setShowIncompatiblePersisted(v: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHOW_INCOMPATIBLE_KEY, v ? '1' : '0');
}

interface PersistedSelection {
  tag?: string;
  asset?: string;
}

function loadSelection(gameId: string): PersistedSelection {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SELECTION_KEY(gameId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSelection(gameId: string, sel: PersistedSelection) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SELECTION_KEY(gameId), JSON.stringify(sel));
  } catch { /* ignore quota errors */ }
}

/**
 * Hook that fetches the releases for a game and exposes the user's
 * version/build selection plus a "show nightlies" toggle.
 */
export function useGameReleases(game: Game | undefined) {
  const repo = useMemo(() => (game ? getGitHubRepo(game) : null), [game]);
  const platform = useMemo<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return (window as any).GetPlatform?.() as string | undefined;
  }, []);
  const arch = useMemo<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return (window as any).GetArch?.() as string | undefined;
  }, []);
  // True when all conditions for Proton-mediated Windows compatibility hold:
  // Linux host, launcher 1.3.0+, user has Proton enabled, and at least one
  // Proton installation was detected. When true, Windows builds are treated
  // as compatible and shown/enabled in the Library (the launcher transparently
  // routes them through Proton at launch time).
  const protonReady = useMemo<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (platform !== 'Linux') return false;
    if (!isLauncherVersionAtLeast('1.3.0')) return false;
    const w = window as any;
    if (typeof w.getUseProton !== 'function') return false;
    if (!w.getUseProton()) return false;
    if (typeof w.getProtonInstallations !== 'function') return false;
    const installs = w.getProtonInstallations();
    return Array.isArray(installs) && installs.length > 0;
  }, [platform]);
  const [releases, setReleases] = useState<GameRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releasesStale, setReleasesStale] = useState(false);
  const [releasesUpdatedAt, setReleasesUpdatedAt] = useState<number | undefined>(undefined);
  const [showNightlies, setShowNightliesState] = useState<boolean>(() => getShowNightlies());

  const setShowNightlies = useCallback((v: boolean) => {
    setShowNightliesState(v);
    setShowNightliesPersisted(v);
  }, []);

  const [showIncompatible, setShowIncompatibleState] = useState<boolean>(() => getShowIncompatible());

  const setShowIncompatible = useCallback((v: boolean) => {
    setShowIncompatibleState(v);
    setShowIncompatiblePersisted(v);
  }, []);

  const [selectedTag, setSelectedTagState] = useState<string | undefined>(undefined);
  const [selectedAsset, setSelectedAssetState] = useState<string | undefined>(undefined);
  const initializedForId = useRef<string | undefined>(undefined);

  // Bumped by `refresh()` to force a fresh GitHub fetch (bypassing the
  // in-memory/localStorage cache) for the "refresh available versions" button.
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  // Reload persisted selection when game changes.
  useEffect(() => {
    if (!game) {
      setSelectedTagState(undefined);
      setSelectedAssetState(undefined);
      initializedForId.current = undefined;
      return;
    }
    if (initializedForId.current === game.id) return;
    const sel = loadSelection(game.id);
    setSelectedTagState(sel.tag);
    setSelectedAssetState(sel.asset);
    initializedForId.current = game.id;
  }, [game?.id]);

  // Fetch releases.
  useEffect(() => {
    if (!repo) {
      setReleases([]);
      setReleasesStale(false);
      setReleasesUpdatedAt(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchReleases(repo, refreshTick > 0)
      .then(list => {
        if (cancelled) return;
        setReleases(list);
        const info = getReleasesCacheInfo(repo);
        setReleasesStale(info?.stale ?? false);
        setReleasesUpdatedAt(info?.fetchedAt);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [repo, refreshTick]);

  // Visible releases according to nightly toggle, sorted newest-first by semver
  // so that visibleReleases[0] is always the latest (not dependent on GitHub's
  // API return order, which can surface re-published older releases at the top).
  const visibleReleases = useMemo(() => {
    const filtered = showNightlies ? releases : releases.filter(r => !r.prerelease);
    return [...filtered].sort(compareReleasesNewestFirst);
  }, [releases, showNightlies]);

  // Resolve the effective selected tag (fallback to latest visible).
  const effectiveTag = useMemo(() => {
    if (selectedTag && visibleReleases.some(r => r.tag === selectedTag)) return selectedTag;
    return visibleReleases[0]?.tag;
  }, [selectedTag, visibleReleases]);

  const selectedRelease = useMemo(() => {
    return visibleReleases.find(r => r.tag === effectiveTag);
  }, [visibleReleases, effectiveTag]);

  // Assets sorted by platform relevance (all preserved, most relevant first).
  const sortedAssets = useMemo(
    () => sortAssetsByRelevance(selectedRelease?.assets ?? [], platform, arch),
    [selectedRelease, platform, arch],
  );

  // Assets that can actually run on this system, filtered by the (optional)
  // platform encoded in each asset's filename. Pre-download we only have the
  // filename to go on, so this is OS-only — architecture mismatches are caught
  // post-download once the binary itself has been scanned (see `selectedBuild`
  // compatibility checks in Library.tsx).
  //
  // Gated on the launcher version so older launchers (which don't know about
  // this feature) keep showing every build as before, and on `platform` being
  // known (i.e. running inside the launcher) — in the browser nothing is hidden.
  const filterIncompatible = !!platform && isLauncherVersionAtLeast('1.3.0');
  const compatibleAssets = useMemo(() => {
    if (!filterIncompatible || showIncompatible) return sortedAssets;
    return sortedAssets.filter(a => isPlatformCompatible(detectAssetPlatform(a.name), platform, protonReady));
  }, [sortedAssets, filterIncompatible, showIncompatible, platform, protonReady]);

  // True when every available asset was filtered out as incompatible (and the
  // "show incompatible" escape hatch hasn't been used) — i.e. nothing on this
  // page can run on the user's system.
  const noCompatibleBuilds = filterIncompatible && !showIncompatible
    && sortedAssets.length > 0 && compatibleAssets.length === 0;

  // Resolve the effective selected asset.
  // When a platform is known (i.e. we're inside the launcher), skip the legacy
  // pickDefaultAsset() Windows-first logic and default to the top of the
  // already platform-sorted compatibleAssets list instead.  A game-specific
  // preferredAssetSuffix still takes precedence when set.  When running in a
  // plain browser (platform undefined), the legacy path is preserved so existing
  // behaviour for web users is unchanged.
  const effectiveAsset = useMemo(() => {
    if (!selectedRelease || !game) return undefined;
    // Honour an explicit selection, but only if it's still offered — a
    // previously-picked asset that's now hidden as incompatible (or that
    // disappeared from the release) shouldn't stick around as the "selected"
    // build.
    if (selectedAsset && compatibleAssets.some(a => a.name === selectedAsset)) return selectedAsset;
    // Honour the explicit per-game preferred suffix first (works for any platform).
    if (game.preferredAssetSuffix) {
      const preferred = `${game.recompName}${game.preferredAssetSuffix}`;
      const hit = compatibleAssets.find(a => a.name.toLowerCase() === preferred.toLowerCase());
      if (hit) return hit.name;
    }
    // The previously-selected asset (e.g. from a different version tag) no
    // longer exists in this release — prefer a build here with the same TU
    // status (vanilla stays vanilla, TU stays TU) over just taking the top
    // of the sorted list.
    const tuMatch = pickAssetPreservingTuStatus(game, selectedAsset, compatibleAssets);
    if (tuMatch) return tuMatch.name;
    // No asset has ever been selected for this game (first-time extraction) —
    // honour the developer-configured default build (vanilla/TU) if set.
    if (!selectedAsset) {
      const preferenceMatch = pickAssetByDefaultBuildPreference(game, compatibleAssets);
      if (preferenceMatch) return preferenceMatch.name;
    }
    // When the launcher provides a platform, trust the already-sorted list.
    if (platform && compatibleAssets.length > 0) return compatibleAssets[0].name;
    // Browser / unknown platform: fall back to the legacy helper so the existing
    // behaviour (prefer .exe on Windows, first asset otherwise) is preserved.
    return pickDefaultAsset(game, compatibleAssets);
  }, [selectedRelease, selectedAsset, game, compatibleAssets, platform]);

  const setSelectedTag = useCallback((tag: string | undefined) => {
    setSelectedTagState(tag);
    if (game) saveSelection(game.id, { ...loadSelection(game.id), tag });
  }, [game]);

  const setSelectedAsset = useCallback((asset: string | undefined) => {
    setSelectedAssetState(asset);
    if (game) saveSelection(game.id, { ...loadSelection(game.id), asset });
  }, [game]);

  return {
    repo,
    loading,
    error,
    releasesStale,
    releasesUpdatedAt,
    releases,
    visibleReleases,
    showNightlies,
    setShowNightlies,
    selectedTag: effectiveTag,
    selectedAsset: effectiveAsset,
    selectedRelease,
    sortedAssets,
    compatibleAssets,
    noCompatibleBuilds,
    showIncompatible,
    setShowIncompatible,
    setSelectedTag,
    setSelectedAsset,
    refresh,
    platform,
    arch,
    protonReady,
  };
}

/**
 * Read the locally-installed version metadata via the launcher (CEF) bridge.
 * Returns null when not running inside the launcher or when no metadata is
 * available yet.
 */
export function readInstalledInfo(recompName: string): InstalledInfo | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (typeof w.getInstalledVersion !== 'function') return null;
  try {
    const raw = w.getInstalledVersion(recompName);
    if (!raw) return null;
    if (typeof raw === 'object') return raw as InstalledInfo;
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed as InstalledInfo : null;
  } catch {
    return null;
  }
}

/**
 * List every build of a game that is currently installed on disk (each living
 * in its own `builds/<tag>/` directory — see `getInstalledBuilds` in the
 * launcher's `games.rs`), sorted newest-first by semver (falling back to the
 * on-disk build key when a build has no recorded version). Returns `[]` when
 * not running inside the launcher, when the bridge doesn't expose the call yet
 * (older launcher), or on error.
 */
export function readInstalledBuilds(recompName: string): InstalledBuild[] {
  if (typeof window === 'undefined') return [];
  const w = window as any;
  if (typeof w.getInstalledBuilds !== 'function') return [];
  try {
    const raw = w.getInstalledBuilds(recompName);
    if (!raw) return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    const builds = parsed as InstalledBuild[];
    return [...builds].sort((a, b) => compareReleasesNewestFirst(
      { tag: a.version || a.name },
      { tag: b.version || b.name },
    ));
  } catch {
    return [];
  }
}

/**
 * Find the installed build matching a given version tag / asset selection
 * (the same predicate used to decide whether the user's current
 * version-picker selection is already installed).
 *
 * A side only counts as a *mismatch* when both the selection and the build
 * report a value and they differ -- mirroring the old single-record
 * `selectionMismatch` check. Sidecars that don't track `asset` (older/migrated
 * installs) would otherwise never match the current selection, permanently
 * showing "Update"/"Install" for a build that's already current. `null`/
 * `undefined` `tag`/`asset` likewise matches anything, so this also doubles as
 * "pick any installed build" when the caller has no explicit selection yet.
 */
export function findInstalledBuild(
  builds: InstalledBuild[],
  tag: string | null | undefined,
  asset: string | null | undefined,
): InstalledBuild | null {
  return builds.find(b =>
    !(tag && b.version && b.version !== tag) &&
    !(asset && b.asset && b.asset !== asset)
  ) ?? null;
}
