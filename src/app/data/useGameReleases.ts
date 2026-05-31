import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../types/game';

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
}

const NIGHTLY_KEY = 'goopie:showNightlies';
const SELECTION_KEY = (gameId: string) => `goopie:gameVersion:${gameId}`;
const RELEASES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedReleases {
  fetchedAt: number;
  releases: GameRelease[];
}

const releasesCache = new Map<string, CachedReleases>();

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

    if (isWindows) {
      if (name.includes('windows') || name.includes('win32') || name.includes('win64')) score -= 10;
      if (name.endsWith('.exe')) score -= 5;
      if (name.endsWith('.zip')) score -= 2;
    }
    if (isLinux) {
      if (name.includes('linux')) score -= 10;
      if (!name.includes('.')) score -= 5;
      if (name.endsWith('.tar.gz')) score -= 2;
    }
    if (isMac) {
      if (name.includes('macos') || name.includes('darwin') || name.includes('osx')) score -= 10;
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

export function getShowNightlies(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(NIGHTLY_KEY) === '1';
}

export function setShowNightliesPersisted(v: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NIGHTLY_KEY, v ? '1' : '0');
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
  const [releases, setReleases] = useState<GameRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNightlies, setShowNightliesState] = useState<boolean>(() => getShowNightlies());

  const setShowNightlies = useCallback((v: boolean) => {
    setShowNightliesState(v);
    setShowNightliesPersisted(v);
  }, []);

  const [selectedTag, setSelectedTagState] = useState<string | undefined>(undefined);
  const [selectedAsset, setSelectedAssetState] = useState<string | undefined>(undefined);
  const initializedForId = useRef<string | undefined>(undefined);

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
      return;
    }
    let cancelled = false;
    const cached = releasesCache.get(repo);
    if (cached && Date.now() - cached.fetchedAt < RELEASES_CACHE_TTL_MS) {
      // Re-sort in case the cached data pre-dates the semver sort.
      setReleases([...cached.releases].sort(compareReleasesNewestFirst));
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, {
      headers: { 'Accept': 'application/vnd.github+json' },
    })
      .then(res => {
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        return res.json();
      })
      .then((data: any[]) => {
        if (cancelled) return;
        const list: GameRelease[] = (Array.isArray(data) ? data : [])
          .filter(r => !r.draft)
          .map(r => ({
            tag: String(r.tag_name ?? ''),
            name: String(r.name ?? r.tag_name ?? ''),
            prerelease: !!r.prerelease,
            publishedAt: r.published_at ?? r.created_at,
            assets: Array.isArray(r.assets)
              ? r.assets.map((a: any) => ({
                  name: String(a.name ?? ''),
                  url: String(a.browser_download_url ?? ''),
                  size: typeof a.size === 'number' ? a.size : undefined,
                }))
              : [],
          }))
          .filter(r => r.tag)
          .sort(compareReleasesNewestFirst);
        releasesCache.set(repo, { fetchedAt: Date.now(), releases: list });
        setReleases(list);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [repo]);

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

  // Resolve the effective selected asset.
  // When a platform is known (i.e. we're inside the launcher), skip the legacy
  // pickDefaultAsset() Windows-first logic and default to the top of the
  // already platform-sorted sortedAssets list instead.  A game-specific
  // preferredAssetSuffix still takes precedence when set.  When running in a
  // plain browser (platform undefined), the legacy path is preserved so existing
  // behaviour for web users is unchanged.
  const effectiveAsset = useMemo(() => {
    if (!selectedRelease || !game) return undefined;
    if (selectedAsset && selectedRelease.assets.some(a => a.name === selectedAsset)) return selectedAsset;
    // Honour the explicit per-game preferred suffix first (works for any platform).
    if (game.preferredAssetSuffix) {
      const preferred = `${game.recompName}${game.preferredAssetSuffix}`;
      const hit = sortedAssets.find(a => a.name.toLowerCase() === preferred.toLowerCase());
      if (hit) return hit.name;
    }
    // When the launcher provides a platform, trust the already-sorted list.
    if (platform && sortedAssets.length > 0) return sortedAssets[0].name;
    // Browser / unknown platform: fall back to the legacy helper so the existing
    // behaviour (prefer .exe on Windows, first asset otherwise) is preserved.
    return pickDefaultAsset(game, sortedAssets);
  }, [selectedRelease, selectedAsset, game, sortedAssets, platform]);

  const setSelectedTag = useCallback((tag: string | undefined) => {
    setSelectedTagState(tag);
    if (game) saveSelection(game.id, { tag, asset: selectedAsset });
  }, [game, selectedAsset]);

  const setSelectedAsset = useCallback((asset: string | undefined) => {
    setSelectedAssetState(asset);
    if (game) saveSelection(game.id, { tag: selectedTag, asset });
  }, [game, selectedTag]);

  return {
    repo,
    loading,
    error,
    releases,
    visibleReleases,
    showNightlies,
    setShowNightlies,
    selectedTag: effectiveTag,
    selectedAsset: effectiveAsset,
    selectedRelease,
    sortedAssets,
    setSelectedTag,
    setSelectedAsset,
    platform,
    arch,
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
