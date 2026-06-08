import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GameList } from '../components/GameList';
import { TopBar } from '../components/TopBar';
import { Sidebar, SIDEBAR_WIDTH_CLASS } from '../components/Sidebar';
import { GameEditor } from '../components/GameEditor';
import { Play, FolderOpen, Trash2, Download, RefreshCw, Globe, ExternalLink, AlertTriangle, Loader2, Pencil, EyeOff, Eye, Info, Save, X, Bug, ArrowLeft, Star, ChevronDown, Newspaper, Car } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '../components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Game, Platform } from '../types/game';
import { useAuth } from '../auth/AuthContext';
import { useGameStore } from '../data/GameStore';
import { useRatings } from '../data/useRatings';
import { useFavorites } from '../data/useFavorites';
import { usePlaytime } from '../data/usePlaytime';
import { useCvarSettings } from '../data/useCvarSettings';
import { StarRating } from '../components/StarRating';
import { useTheme } from '../theme/ThemeContext';
import { useBackgroundAccent } from '../theme/BackgroundAccentContext';
import { useXMBAccentVars } from '../hooks/useXMBAccentVars';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { BackgroundAudioPlayer } from '../components/BackgroundAudioPlayer';
import { Markdown } from '../components/Markdown';
import { useNews } from '../data/useNews';
import { buildReleaseDownloadPrefix, pickDefaultAsset, sortAssetsByRelevance, readInstalledBuilds, findInstalledBuild, useGameReleases, type InstalledBuild } from '../data/useGameReleases';
import { GameVersionPicker } from '../components/GameVersionPicker';
import { isInLauncher, isInTauriLauncher, openExternal as openExternalUrl } from '../utils/externalLink';

const statusColors: Record<Game['status'], string> = {
  Ingame: 'bg-red-500 text-white',
  Stable: 'bg-green-500 text-white',
  Playable: 'bg-white text-black',
  Enhanced: 'bg-blue-500 text-white',
  External: 'bg-orange-500 text-white',
};

const statusDescriptions: Record<Game['status'], string> = {
  Enhanced: '100% playable with no crashes and includes mods',
  Stable: '100% playable with no crashes',
  Playable: 'Very little crashes',
  Ingame: 'Very little crashes but has graphics issues',
  External: 'Uses an external launcher download',
};

/**
 * Lists every locally-installed build of the selected game (each living in
 * its own `builds/<tag>/` directory), with per-build Play / Remove actions --
 * letting the user manage builds individually rather than only the one
 * currently targeted by the version picker. Collapsed by default since most
 * users only ever care about their current selection; hidden entirely when
 * nothing is installed.
 */
function InstalledBuildsList({
  builds,
  onPlay,
  onClose,
  onRemove,
  runningBuild,
  compact,
}: {
  builds: InstalledBuild[];
  onPlay: (build: InstalledBuild) => void;
  onClose: (build: InstalledBuild) => void;
  onRemove: (build: InstalledBuild) => void;
  /** Name of the build currently running for this game, if any. */
  runningBuild?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (builds.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        className={`flex items-center gap-1 font-semibold uppercase tracking-wide ${compact ? 'text-[10px]' : 'text-xs'}`}
        style={{ color: 'var(--theme-text-muted)' }}
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown className={`transition-transform ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${open ? '' : '-rotate-90'}`} />
        Installed builds ({builds.length})
      </button>
      {open && builds.map(build => {
        const isRunning = !!runningBuild && build.name === runningBuild;
        return (
        <div
          key={build.name}
          className={`flex items-center justify-between gap-2 rounded-md ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
          style={{ backgroundColor: 'var(--theme-page-bg)' }}
        >
          <span className={`truncate ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: 'var(--theme-text-primary)' }}>
            {build.version || build.name}
            {build.asset ? ` · ${build.asset}` : ''}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {isRunning ? (
              <Button
                variant="ghost"
                size="icon"
                className="hover:opacity-80"
                style={{ color: '#a52525' }}
                title="Close this build"
                onClick={() => onClose(build)}
              >
                <X className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="hover:opacity-80"
                style={{ color: 'var(--theme-text-secondary)' }}
                title="Play this build"
                onClick={() => onPlay(build)}
              >
                <Play className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hover:opacity-80 disabled:opacity-30 disabled:pointer-events-none"
              style={{ color: 'var(--theme-text-secondary)' }}
              title={isRunning ? 'Close the build before removing it' : 'Remove this build'}
              disabled={isRunning}
              onClick={() => onRemove(build)}
            >
              <Trash2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </Button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

export function Library() {
  const { recompName: urlRecompName } = useParams<{ recompName: string }>();
  const navigate = useNavigate();
  const { user, canEditGame, assignGame } = useAuth();
  const { games, saveGame, deleteGame, getVisibleGames } = useGameStore();
  const { gameRatings, userRatings, rateGame } = useRatings(user?.uid);
  const { isFavorite, toggleFavorite, favorites, reorderFavorites } = useFavorites(user?.uid);
  const { recordSession } = usePlaytime(user?.uid);
  const { posts: newsPosts } = useNews();
  const { theme } = useTheme();
  const { setAccentColor } = useBackgroundAccent();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<Game['status'][]>(['Enhanced', 'Stable', 'Playable', 'External']);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [hideExternal, setHideExternal] = useState(false);
  const [platformFilters, setPlatformFilters] = useState<Platform[]>(() => {
    const w = window as any;
    if (w.GetPlatform) {
      const plat: string = w.GetPlatform();
      if (plat === 'Windows') return ['Windows'] as Platform[];
      if (plat === 'macOS') return ['Mac'] as Platform[];
      if (plat === 'Linux') return ['Linux'] as Platform[];
    }
    return [];
  });
  const [audioKey, setAudioKey] = useState(0);
  const [audioMuted, setAudioMuted] = useState(() => {
    try { return localStorage.getItem('goopie:audioMuted') === '1'; } catch { return false; }
  });
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [headerIdx, setHeaderIdx] = useState(0);
  // Two-slot double-buffer for the header image swap.  Neither slot is ever
  // keyed by src, so both stay mounted across game switches — the outgoing
  // image stays painted while the incoming one decodes, then React flips
  // activeSlot.  In browser/CEF the swap uses an opacity cross-fade; in the
  // Tauri/WebKit launcher transitions are disabled (instant swap).
  const isTauri = isInTauriLauncher();
  // Legacy CEF launcher: in a launcher, but not the new Tauri one.
  const isLegacyLauncher = isInLauncher() && !isTauri;
  const [slotA, setSlotA] = useState({ src: '' });
  const [slotB, setSlotB] = useState({ src: '' });
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const activeSlotRef = useRef<'A' | 'B'>('A');
  const pendingCrossfadeRef = useRef(0);
  const [chosenAudioUrl, setChosenAudioUrl] = useState<string | undefined>(undefined);
  const [isoInstalled, setIsoInstalled] = useState(false);
  const [isInCEF, setIsInCEF] = useState(false);
  const [launcherOutdated, setLauncherOutdated] = useState(false);
  const [latestLauncherVersion, setLatestLauncherVersion] = useState<string | null>(null);
  const [canSelfUpdate, setCanSelfUpdate] = useState(false);
  const [updatingLauncher, setUpdatingLauncher] = useState(false);
  const [exeUpdated, setExeUpdated] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadString, setDownloadString] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractString, setExtractString] = useState('');
  const [infoBannerDismissed, setInfoBannerDismissed] = useState(() => {
    try { return localStorage.getItem('goopie:infoBannerDismissed') === '1'; } catch { return false; }
  });
  const [legacyBannerDismissed, setLegacyBannerDismissed] = useState(() => {
    try { return localStorage.getItem('goopie:legacyLauncherBannerDismissed') === '1'; } catch { return false; }
  });
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appliedUrlRef = useRef<string | undefined>(undefined);
  // Currently-running game (per native `getRunningGame()`), polled so the
  // Play button can flip to "Close" and so launching a different game can
  // prompt to close the running one first.
  const [runningGame, setRunningGame] = useState<{ game: string; build: string } | null>(null);
  const runningGameRef = useRef<{ game: string; build: string; secondsPlayed: number } | null>(null);
  const [pendingPlayBuild, setPendingPlayBuild] = useState<InstalledBuild | null>(null);

  const visibleGames = useMemo(() => {
    return getVisibleGames(user?.role, user?.assignedGames || []);
  }, [games, user, getVisibleGames]);

  const statusOrder: Record<Game['status'], number> = {
    Enhanced: 0,
    Stable: 1,
    Playable: 2,
    Ingame: 3,
    External: 4,
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    visibleGames.forEach(game => game.Tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [visibleGames]);

  const filteredGames = useMemo(() => {
    // Bayesian global mean — computed once per ratings change instead of inside
    // the sort comparator (which would recompute it for every comparison).
    let totalSum = 0;
    let totalCount = 0;
    for (const info of Object.values(gameRatings)) {
      totalSum += info.averageRating * info.totalRatings;
      totalCount += info.totalRatings;
    }
    const C = totalCount > 0 ? totalSum / totalCount : 0;
    const m = 3; // minimum votes before the raw average is fully trusted

    // Favorites get pinned to the top in the exact order they appear on the
    // Favorites page (i.e. the user-controlled order from `favorites`).
    const favOrder = new Map<string, number>();
    favorites.forEach((id, i) => favOrder.set(id, i));

    return visibleGames
      .filter(game => {
        const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            game.og_developer.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        // Favorites bypass status/tag/external/platform filters so a pinned
        // game (e.g. an Ingame one hidden by default) is always visible.
        if (favOrder.has(game.id)) return true;
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(game.status);
        const matchesTags = tagFilters.length === 0 || tagFilters.some(tag => game.Tags.includes(tag));
        const matchesExternal = !hideExternal || !game.externalLauncherUrl;
        if (isInCEF && game.status === 'External') return false;
        const matchesPlatform = platformFilters.length === 0 || platformFilters.some(p => game.platforms?.includes(p));
        return matchesStatus && matchesTags && matchesExternal && matchesPlatform;
      })
      .sort((a, b) => {
        const aFav = favOrder.has(a.id);
        const bFav = favOrder.has(b.id);
        if (aFav && bFav) return favOrder.get(a.id)! - favOrder.get(b.id)!;
        if (aFav) return -1;
        if (bFav) return 1;
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        // Bayesian average: pulls games with few ratings toward the global mean
        // W = (v / (v + m)) * R + (m / (v + m)) * C
        const infoA = gameRatings[a.id];
        const infoB = gameRatings[b.id];
        const ra = infoA?.averageRating ?? 0;
        const rb = infoB?.averageRating ?? 0;
        const va = infoA?.totalRatings ?? 0;
        const vb = infoB?.totalRatings ?? 0;
        if (ra === rb) return vb - va;
        const wA = infoA ? (va / (va + m)) * ra + (m / (va + m)) * C : 0;
        const wB = infoB ? (vb / (vb + m)) * rb + (m / (vb + m)) * C : 0;
        if (wA !== wB) return wB - wA;
        return vb - va;
      });
  }, [searchQuery, visibleGames, statusFilters, tagFilters, hideExternal, platformFilters, gameRatings, favorites, isInCEF]);

  // Auto-select game from URL param or first game if none selected
  useEffect(() => {
    if (urlRecompName && visibleGames.length > 0 && appliedUrlRef.current !== urlRecompName) {
      const game = visibleGames.find(g => g.recompName.toLowerCase() === urlRecompName.toLowerCase());
      if (game) {
        setSelectedGameId(game.id);
        appliedUrlRef.current = urlRecompName;
        return;
      }
    }
    if (!selectedGameId && filteredGames.length > 0) {
      setSelectedGameId(filteredGames[0].id);
    }
  }, [selectedGameId, visibleGames, filteredGames, urlRecompName]);

  const selectedGame = visibleGames.find(g => g.id === selectedGameId);

  // Per-game launcher cvar settings (persisted in localStorage).
  const { getValue: getCvarValue, setValue: setCvarValue, reset: resetCvar, buildArgs: buildCvarArgs } =
    useCvarSettings(selectedGame?.id, selectedGame?.cvars);

  // Per-game release/version selection (GitHub releases enumeration).
  const releasesState = useGameReleases(selectedGame);
  const {
    repo: githubRepo,
    releases: allReleases,
    visibleReleases,
    sortedAssets,
    showNightlies,
    setShowNightlies,
    selectedTag,
    selectedAsset,
    setSelectedTag,
    setSelectedAsset,
    loading: releasesLoading,
    error: releasesError,
    releasesStale,
    releasesUpdatedAt,
    platform: launcherPlatform,
    arch: launcherArch,
  } = releasesState;
  // Every build of the selected game that is currently installed in its own
  // `builds/<tag>/` directory (see games.rs::get_installed_builds). Multiple
  // builds can coexist side-by-side now that updates no longer overwrite.
  const [installedBuilds, setInstalledBuilds] = useState<InstalledBuild[]>([]);

  // The installed build matching the user's current version-picker selection
  // (if any) -- i.e. the build that Play/Uninstall/Update should target.
  const selectedBuild = useMemo(
    () => findInstalledBuild(installedBuilds, selectedTag, selectedAsset),
    [installedBuilds, selectedTag, selectedAsset],
  );

  // Compute the download URL prefix passed to the launcher's Update().
  const releaseDownloadPrefix = useMemo(() => {
    if (!githubRepo || !selectedTag) return selectedGame?.githubReleaseUrl ?? '';
    return buildReleaseDownloadPrefix(githubRepo, selectedTag);
  }, [githubRepo, selectedTag, selectedGame?.githubReleaseUrl]);

  // With per-build directories, picking a tag/asset that isn't installed no
  // longer means "needs an update" -- it means "install this as a new,
  // separate build". `selectionMismatch` now flags exactly that: the user has
  // *some* build(s) installed, but none matches their current selection, so
  // the action button should read "Install" (a fresh side-by-side install)
  // rather than "Update" (refresh the selected build in place).
  const selectionMismatch = useMemo(() => {
    if (installedBuilds.length === 0) return false;
    return !selectedBuild;
  }, [installedBuilds, selectedBuild]);

  // Latest release tag in the same channel as the currently selected/installed
  // build (a nightly install only looks at other nightlies, a stable install
  // only at other stable releases). `null` when there's no basis for
  // comparison, or the user has explicitly pinned to a different (older)
  // version than what's installed -- selectionMismatch handles that case.
  const latestChannelTag = useMemo(() => {
    if (!selectedBuild?.version) return null;
    if (selectedTag && selectedBuild.version !== selectedTag) return null;
    const installedIsNightly = allReleases.find(r => r.tag === selectedBuild.version)?.prerelease ?? false;
    const candidates = allReleases.filter(r => r.prerelease === installedIsNightly);
    return candidates[0]?.tag ?? null;
  }, [selectedBuild, selectedTag, allReleases]);

  // When a newer release exists but the user already has it installed as its
  // own side-by-side build, there's nothing to download -- the action should
  // just point the version picker at that build so Play targets it directly,
  // not redownload something that's already on disk.
  const newerInstalledBuild = useMemo(() => {
    if (!latestChannelTag || latestChannelTag === selectedBuild?.version) return null;
    return installedBuilds.find(b => b.version === latestChannelTag) ?? null;
  }, [latestChannelTag, selectedBuild, installedBuilds]);

  // Detect when a newer release is available *and actually needs downloading*
  // -- i.e. it isn't already sitting on disk as a separate build (that's
  // `newerInstalledBuild`'s job, which just switches the selection instead).
  const newerReleaseAvailable = useMemo(() => {
    if (!latestChannelTag || !selectedBuild?.version) return false;
    return latestChannelTag !== selectedBuild.version && !newerInstalledBuild;
  }, [latestChannelTag, selectedBuild, newerInstalledBuild]);

  // Switch the version-picker selection to an already-installed build (e.g.
  // hopping from an older side-by-side install to the latest one) without
  // touching the filesystem -- Play/Uninstall then retarget immediately.
  const switchToInstalledBuild = useCallback((build: InstalledBuild) => {
    setSelectedTag(build.version);
    setSelectedAsset(build.asset);
  }, [setSelectedTag, setSelectedAsset]);

  // When a newer version is available (and the user hasn't pinned to a different
  // version), resolve update targets to the correct channel; otherwise fall back
  // to whatever the user has currently selected.
  const updateInfo = useMemo(() => {
    if (newerReleaseAvailable && githubRepo && selectedGame) {
      const installedIsNightly = allReleases.find(r => r.tag === selectedBuild?.version)?.prerelease ?? false;
      const target = allReleases.filter(r => r.prerelease === installedIsNightly)[0];
      if (target) {
        const targetSorted = sortAssetsByRelevance(target.assets, launcherPlatform, launcherArch);
        // Mirror the platform-aware logic in effectiveAsset: prefer the game's
        // explicit suffix, then the top of the platform-sorted list when the
        // platform is known, then fall back to the legacy helper.
        let asset: string | undefined;
        if (selectedGame.preferredAssetSuffix) {
          const preferred = `${selectedGame.recompName}${selectedGame.preferredAssetSuffix}`;
          asset = targetSorted.find(a => a.name.toLowerCase() === preferred.toLowerCase())?.name;
        }
        if (!asset && launcherPlatform && targetSorted.length > 0) {
          asset = targetSorted[0].name;
        }
        if (!asset) asset = pickDefaultAsset(selectedGame, targetSorted);
        return {
          tag: target.tag,
          prefix: buildReleaseDownloadPrefix(githubRepo, target.tag),
          asset: asset ?? selectedAsset,
        };
      }
    }
    return { tag: selectedTag, prefix: releaseDownloadPrefix, asset: selectedAsset };
  }, [newerReleaseAvailable, githubRepo, allReleases, selectedBuild, selectedGame, selectedTag, releaseDownloadPrefix, selectedAsset, launcherPlatform, launcherArch]);

  const triggerUpdate = useCallback(() => {
    if (!selectedGame) return;
    const w = window as any;
    if (typeof w.Update !== 'function') return;
    w.Update(
      selectedGame.recompName,
      updateInfo.prefix ?? '',
      updateInfo.asset ?? '',
      updateInfo.tag ?? '',
    );
    // If we advanced to a newer release, persist the new tag so that
    // selectionMismatch doesn't immediately fire again after install.
    if (newerReleaseAvailable && updateInfo.tag) {
      setSelectedTag(updateInfo.tag);
    }
    setUpdating(true);
    setDownloadProgress(0);
    setDownloadString('');
  }, [selectedGame, updateInfo, newerReleaseAvailable, setSelectedTag]);

  // Normalize headerImage to an array
  const headerImages = useMemo(() => {
    if (!selectedGame) return [];
    return Array.isArray(selectedGame.headerImage) ? selectedGame.headerImage : [selectedGame.headerImage];
  }, [selectedGame]);

  // Reset header index when the selected game changes
  useEffect(() => {
    setHeaderIdx(0);
  }, [selectedGameId]);

  // Cross-fade to the target header image whenever the game or rotation index
  // changes.  We load the incoming src into the inactive slot first and only
  // flip `activeSlot` once the image has decoded — so the outgoing image stays
  // painted underneath until the new one is ready, producing a true cross-fade.
  useEffect(() => {
    const src = headerImages[headerIdx];
    if (!src) return;
    const token = ++pendingCrossfadeRef.current;
    // Determine which slot is currently inactive and stage the new src there.
    const incoming: 'A' | 'B' = activeSlotRef.current === 'A' ? 'B' : 'A';
    if (incoming === 'A') setSlotA({ src }); else setSlotB({ src });
    // Decode before swap to avoid a white flash.
    const img = new Image();
    img.src = src;
    const decodeP = typeof img.decode === 'function'
      ? img.decode().catch(() => {})
      : new Promise<void>(r => { img.complete ? r() : (img.onload = img.onerror = () => r()); });
    decodeP.then(() => {
      if (token !== pendingCrossfadeRef.current) return; // superseded by a newer request
      activeSlotRef.current = incoming;
      setActiveSlot(incoming);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame?.id, headerIdx]);

  // Cycle header images every 7 seconds (within a single game)
  useEffect(() => {
    if (headerImages.length <= 1) return;
    const timer = setInterval(() => {
      setHeaderIdx(prev => (prev + 1) % headerImages.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [headerImages.length]);

  // Pick initial audio when game is auto-selected (not via handleSelectGame)
  useEffect(() => {
    if (!selectedGame) { setChosenAudioUrl(undefined); return; }
    if (chosenAudioUrl !== undefined) return; // already set by handleSelectGame
    if (selectedGame.backgroundAudio) {
      const urls = Array.isArray(selectedGame.backgroundAudio) ? selectedGame.backgroundAudio : [selectedGame.backgroundAudio];
      setChosenAudioUrl(urls.length > 0 ? urls[Math.floor(Math.random() * urls.length)] : undefined);
    }
  }, [selectedGame?.id]);

  const checkState = useCallback(() => {
    const w = window as any;
    if (selectedGame) {
      setIsoInstalled(w.isIsoInstalled ? w.isIsoInstalled(selectedGame.recompName) : false);
      // Re-read the full set of installed builds, then resolve the one
      // matching the current version-picker selection (if any) -- that's the
      // build whose exe/update status we report and that Play/Uninstall act on.
      const builds = readInstalledBuilds(selectedGame.recompName);
      setInstalledBuilds(builds);
      const matching = findInstalledBuild(builds, selectedTag, selectedAsset);
      setExeUpdated(matching && w.isExeUpdated ? w.isExeUpdated(selectedGame.recompName, matching.name) : false);
      const isUp = w.isUpdating ? w.isUpdating(selectedGame.id) : false;
      setUpdating(isUp);
      if (isUp) {
        setDownloadProgress(w.getDownloadProgress ? w.getDownloadProgress(selectedGame.id) : 0);
        setDownloadString(w.getDownloadString ? w.getDownloadString(selectedGame.id) : '');
      }
      const isExt = w.isExtracting ? w.isExtracting(selectedGame.id) : false;
      setExtracting(isExt);
      if (isExt) {
        setExtractProgress(w.getExtractProgress ? w.getExtractProgress(selectedGame.id) : 0);
        setExtractString(w.getExtractString ? w.getExtractString(selectedGame.id) : 'Extracting...');
      }
    }
  }, [selectedGame, selectedTag, selectedAsset]);

  useEffect(() => {
    checkState();
  }, [checkState]);

  // Poll the running game (drives the Play/Close button swap and the
  // close-confirmation prompt). Whenever the tracked game/build changes —
  // whether the process exited on its own or was closed to launch another —
  // record the finished session's playtime against the game it belongs to.
  useEffect(() => {
    const w = window as any;
    if (typeof w.getRunningGame !== 'function') return;
    const poll = () => {
      const running = w.getRunningGame();
      const prev = runningGameRef.current;
      const next = running
        ? { game: String(running.game), build: String(running.build), secondsPlayed: Number(running.secondsPlayed) || 0 }
        : null;

      if (prev && (prev.game !== next?.game || prev.build !== next?.build)) {
        const finishedGame = games.find(g => g.recompName === prev.game);
        if (finishedGame) void recordSession(finishedGame.id, prev.secondsPlayed);
      }

      runningGameRef.current = next;
      setRunningGame(prevState => {
        if (prevState?.game === next?.game && prevState?.build === next?.build) return prevState;
        return next ? { game: next.game, build: next.build } : null;
      });
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [games, recordSession]);

  // Launch a specific installed build directly (used by the "Installed builds"
  // list, independent of whichever build the version picker currently targets).
  const playBuild = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    const w = window as any;
    if (typeof w.Play !== 'function') return;
    setAudioMuted(true);
    w.Play(selectedGame.recompName, build.name, buildCvarArgs(), undefined, selectedGame.setGameDataRootToAssets === true);
  }, [selectedGame, buildCvarArgs]);

  // Name of the running build, if it belongs to the selected game (used to
  // mark the matching row in the installed-builds list as "running").
  const runningBuildForSelectedGame = (selectedGame && runningGame && runningGame.game === selectedGame.recompName)
    ? runningGame.build
    : null;

  // Whether the build the big Play/Close button currently targets is the one
  // actually running (vs. a different build of the same game, or another game
  // entirely — both of which still show "Play" but prompt to close first).
  const isSelectedBuildRunning = !!(selectedBuild && runningBuildForSelectedGame === selectedBuild.name);

  // Entry point for any Play action: if a *different* game — or a different
  // build of this game — is running, prompt before closing it (unsaved
  // progress is lost); otherwise launch directly.
  const requestPlay = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    if (runningGame && (runningGame.game !== selectedGame.recompName || runningGame.build !== build.name)) {
      setPendingPlayBuild(build);
      return;
    }
    playBuild(build);
  }, [selectedGame, runningGame, playBuild]);

  // Closes whatever game is currently running (used both by the "Close" button
  // and, after confirmation, right before launching a different game).
  const closeRunningGame = useCallback(() => {
    const w = window as any;
    if (typeof w.closeGame === 'function') w.closeGame();
  }, []);

  const confirmCloseAndPlay = useCallback(() => {
    const build = pendingPlayBuild;
    setPendingPlayBuild(null);
    if (!build) return;
    closeRunningGame();
    playBuild(build);
  }, [pendingPlayBuild, closeRunningGame, playBuild]);

  // Remove a single installed build's directory (leaves saves/assets and any
  // other installed builds of the same game untouched).
  const removeBuild = useCallback((build: InstalledBuild) => {
    if (!selectedGame) return;
    const w = window as any;
    if (typeof w.Uninstall !== 'function') return;
    w.Uninstall(selectedGame.recompName, build.name);
    // If the build we just removed is the one the picker is currently
    // pointed at, retarget the selection to whatever's left (newest first) so
    // the UI shows that build instead of "Not installed" when there's
    // actually another side-by-side install available.
    if (selectedBuild?.name === build.name) {
      const remaining = readInstalledBuilds(selectedGame.recompName);
      const next = remaining[0] ?? null;
      setSelectedTag(next?.version);
      setSelectedAsset(next?.asset);
    }
    checkState();
  }, [selectedGame, selectedBuild, setSelectedTag, setSelectedAsset, checkState]);

  // Delete the extracted ISO/asset data for the selected game (reclaiming the
  // disk space it takes up) without touching saves or any installed builds.
  // Only meaningful once every build has been uninstalled -- while a build is
  // still around, removing assets out from under it would break it.
  const removeAssets = useCallback(() => {
    if (!selectedGame) return;
    const w = window as any;
    if (typeof w.RemoveAssets !== 'function') return;
    w.RemoveAssets(selectedGame.recompName);
    checkState();
  }, [selectedGame, checkState]);

  // Check launcher version on mount
  useEffect(() => {
    const w = window as any;
    if (w.getVersion) {
      const version = w.getVersion();
      setIsInCEF(typeof version === 'string');
      setCanSelfUpdate(!!w.SelfUpdateLauncher);
      if (w.CheckForLauncherUpdate) {
        const info = w.CheckForLauncherUpdate();
        if (info?.hasUpdate) {
          setLauncherOutdated(true);
          setLatestLauncherVersion(info.latestVersion ?? null);
        }
      }
    }
  }, []);

  // In XMB theme, override UI CSS vars to match the selected game's accent colour
  useXMBAccentVars(theme, selectedGame?.accentColor);

  // Drive the global theme background's accent color from the current game.
  useEffect(() => {
    setAccentColor(selectedGame?.accentColor);
    return () => setAccentColor(undefined);
  }, [selectedGame?.accentColor, setAccentColor]);

  // Poll progress while updating or extracting
  useEffect(() => {
    if (updating || extracting || updatingLauncher) {
      pollRef.current = setInterval(() => {
        const w = window as any;
        if (updatingLauncher) {
          setDownloadProgress(w.getDownloadProgress ? w.getDownloadProgress() : 0);
          setDownloadString(w.getDownloadString ? w.getDownloadString() : '');
        }
        if (selectedGame) {
          // Update check
          const isUp = w.isUpdating ? w.isUpdating(selectedGame.id) : false;
          setUpdating(isUp);
          if (isUp) {
            setDownloadProgress(w.getDownloadProgress ? w.getDownloadProgress(selectedGame.id) : 0);
            setDownloadString(w.getDownloadString ? w.getDownloadString(selectedGame.id) : '');
          } else {
            const builds = readInstalledBuilds(selectedGame.recompName);
            setInstalledBuilds(builds);
            const matching = findInstalledBuild(builds, selectedTag, selectedAsset);
            setExeUpdated(matching && w.isExeUpdated ? w.isExeUpdated(selectedGame.recompName, matching.name) : false);
          }
          // Extract check
          const isExt = w.isExtracting ? w.isExtracting(selectedGame.id) : false;
          setExtracting(isExt);
          if (isExt) {
            setExtractProgress(w.getExtractProgress ? w.getExtractProgress(selectedGame.id) : 0);
            setExtractString(w.getExtractString ? w.getExtractString(selectedGame.id) : 'Extracting...');
          } else {
            setIsoInstalled(w.isIsoInstalled ? w.isIsoInstalled(selectedGame.recompName) : false);
          }
        }
      }, 500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [updating, extracting, updatingLauncher, selectedGame, selectedTag, selectedAsset]);

  // Steady-state install-state refresh (1.5 s) while inside the launcher and
  // not already in a fast-poll cycle.  This ensures that completing an ISO
  // extraction (or any other native operation) is reflected without a manual
  // page reload, even when the fast poll has already torn down its interval.
  const steadyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (steadyPollRef.current) clearInterval(steadyPollRef.current);
    if (!isInCEF || !selectedGame) return;
    steadyPollRef.current = setInterval(() => {
      if (!updating && !extracting) checkState();
    }, 1500);
    return () => {
      if (steadyPollRef.current) clearInterval(steadyPollRef.current);
    };
  }, [isInCEF, selectedGame, updating, extracting, checkState]);

  // Re-check install state when the user returns to the window (e.g. after
  // dismissing the native ISO file-picker).
  useEffect(() => {
    if (!isInCEF) return;
    const onFocus = () => checkState();
    const onVisible = () => { if (document.visibilityState === 'visible') checkState(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isInCEF, checkState]);

  // Persist audio mute preference across page loads.
  useEffect(() => {
    try { localStorage.setItem('goopie:audioMuted', audioMuted ? '1' : '0'); } catch { /* quota */ }
  }, [audioMuted]);

  // Persist piracy-banner dismissal across page loads.
  useEffect(() => {
    try { localStorage.setItem('goopie:infoBannerDismissed', infoBannerDismissed ? '1' : '0'); } catch { /* quota */ }
  }, [infoBannerDismissed]);

  // Persist the legacy-launcher upgrade-banner dismissal across page loads.
  useEffect(() => {
    try { localStorage.setItem('goopie:legacyLauncherBannerDismissed', legacyBannerDismissed ? '1' : '0'); } catch { /* quota */ }
  }, [legacyBannerDismissed]);

  const handleSelectGame = useCallback((id: string) => {
    setSelectedGameId(id);
    setShowMobileDetail(true);
    setAudioKey(k => k + 1);
    // Pick a random background audio URL
    const game = visibleGames.find(g => g.id === id);
    if (game?.backgroundAudio) {
      const urls = Array.isArray(game.backgroundAudio) ? game.backgroundAudio : [game.backgroundAudio];
      setChosenAudioUrl(urls.length > 0 ? urls[Math.floor(Math.random() * urls.length)] : undefined);
    } else {
      setChosenAudioUrl(undefined);
    }
  }, [visibleGames]);

  const getYouTubeVideoId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1].split('?')[0];
        return u.searchParams.get('v');
      }
    } catch { /* invalid URL */ }
    return null;
  };

  const openExternal = useCallback((url: string) => {
    if (isInCEF) {
      (window as any).OpenExternalLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [isInCEF]);

  return (
    <div className={`flex h-screen flex-col relative ${SIDEBAR_WIDTH_CLASS}`} style={{ backgroundColor: 'var(--theme-page-bg)' }}>
      <Sidebar />
      {launcherOutdated && (
        <div className="bg-[#b8860b] px-4 md:px-6 py-2 md:py-3 flex items-center justify-center gap-2 md:gap-3 relative z-10">
          {updatingLauncher ? (
            <>
              <Loader2 className="w-4 h-4 text-white shrink-0 animate-spin" />
              <span className="text-white font-semibold text-xs md:text-sm">
                Updating launcher… {downloadProgress > 0 ? `${downloadProgress}%` : ''}{downloadString ? ` (${downloadString})` : ''}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-white shrink-0" />
              <span className="text-white font-semibold text-xs md:text-sm">
                Your launcher is outdated{latestLauncherVersion ? ` (${latestLauncherVersion} available)` : ''}.
              </span>
              {canSelfUpdate ? (
                <button
                  className="text-white underline font-bold text-xs md:text-sm hover:text-yellow-200 transition-colors"
                  onClick={() => {
                    (window as any).SelfUpdateLauncher();
                    setUpdatingLauncher(true);
                  }}
                >
                  Update now
                </button>
              ) : (
                <a
                  className="text-white underline font-bold text-xs md:text-sm hover:text-yellow-200 transition-colors cursor-pointer"
                  onClick={() => openExternal('https://goopie.xyz/')}
                >
                  Download at goopie.xyz
                </a>
              )}
            </>
          )}
        </div>
      )}
      {isLegacyLauncher && !legacyBannerDismissed && (
        <div className="bg-yellow-400 px-4 md:px-6 py-2 flex items-center justify-center gap-2 md:gap-3 relative z-10 text-center pr-8">
          <AlertTriangle className="w-4 h-4 text-yellow-950 shrink-0" />
          <span className="text-yellow-950 text-xs md:text-sm font-semibold leading-tight">
            A new, self-updating Goopie launcher is available.{' '}
            <a
              className="underline font-bold cursor-pointer hover:text-black"
              onClick={() => openExternal('https://goopie.xyz/downloads')}
            >
              Download it at goopie.xyz/downloads
            </a>
            . Please uninstall the old launcher before installing the new one.
          </span>
          <button
            onClick={() => setLegacyBannerDismissed(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-yellow-950 hover:text-black transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {!infoBannerDismissed && (
      <div className="bg-[#1a3a5c] px-4 md:px-6 py-1 flex items-center justify-center gap-2 md:gap-3 relative z-10 text-center pr-8">
        <Info className="w-3 h-3 text-blue-200 shrink-0" />
        <span className="text-blue-100 text-[11px] leading-tight">
          We do not support piracy. We are not affiliated in any way with any game studio and/or Microsoft. By using this app you agree to our{' '}
          <Link to="/eula" className="underline hover:text-white">EULA</Link> and{' '}
          <Link to="/privacy" className="underline hover:text-white">Privacy Policy</Link>.{' '}
          Games are Powered by the <a href="https://github.com/rexglue/rexglue-sdk" target="_blank" rel="noopener noreferrer" className="underline hover:text-white" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal('https://github.com/rexglue/rexglue-sdk'); } }}>rexglue-sdk</a>.
        </span>
        <button onClick={() => setInfoBannerDismissed(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-200 hover:text-white transition-colors" aria-label="Dismiss">
          <X className="w-3 h-3" />
        </button>
      </div>
      )}
      <div className="relative z-20">
        <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} audioMuted={audioMuted} onToggleMute={() => setAudioMuted(m => !m)} isInCEF={isInCEF} />
      </div>
      
      <div className="flex flex-1 overflow-hidden relative z-10">
        <GameList 
          games={filteredGames} 
          selectedGameId={selectedGameId}
          onSelectGame={handleSelectGame}
          onCreateGame={(user?.role === 'admin' || user?.role === 'developer') ? () => { setEditingGame(null); setIsCreating(true); setShowEditor(true); } : undefined}
          statusFilters={statusFilters}
          onStatusFiltersChange={setStatusFilters}
          tagFilters={tagFilters}
          onTagFiltersChange={setTagFilters}
          hideExternal={hideExternal}
          onHideExternalChange={setHideExternal}
          allTags={allTags}
          platformFilters={platformFilters}
          onPlatformFiltersChange={setPlatformFilters}
          gameRatings={gameRatings}
          favoriteIds={favorites}
          onReorderFavorites={reorderFavorites}
          className={showMobileDetail ? 'hidden md:flex' : 'flex'}
        />

        {/* Game Detail View */}
        <div className={`flex-1 relative overflow-hidden md:flex md:flex-col ${showMobileDetail ? 'flex flex-col' : 'hidden'}`}>
          {/* Mobile back button */}
          <button
            onClick={() => setShowMobileDetail(false)}
            className="md:hidden flex items-center gap-2 px-4 py-3 text-sm font-medium shrink-0 border-b"
            style={{ backgroundColor: 'var(--theme-topbar-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto relative" >
          {selectedGame ? (
            <>
              {/* Header Image — two persistent slots swap on game/image change.
                  Browser/CEF: 1 s opacity cross-fade.  Tauri: instant (no transition). */}
              <div className="relative h-[200px] md:h-[500px] overflow-hidden z-10 ">
                {([{ id: 'A', slot: slotA }, { id: 'B', slot: slotB }] as const).map(({ id, slot }) => (
                  <img
                    key={id}
                    src={slot.src}
                    alt={selectedGame.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      opacity: activeSlot === id ? (('var(--theme-header-alpha)' as unknown) as number) : 0,
                      transition: isTauri ? undefined : 'opacity 1s ease-in-out',
                    }}
                  />
                ))}
                <div className="absolute inset-0" style={{ backgroundColor: 'var(--theme-header-color)', mixBlendMode: 'multiply' }} />
                <div className="absolute inset-0" style={{ backgroundColor: 'var(--theme-header-overlay)' }} />
                {selectedGame.titleImage && (
                  <img
                    src={selectedGame.titleImage}
                    alt={selectedGame.title}
                    className="absolute top-4 left-4 object-contain drop-shadow-2xl hidden md:block"
                    style={{
                      maxHeight: `${170 * (selectedGame.titleSizeMultiplier || 1)}px`,
                      maxWidth: `${0.45 * 100 * (selectedGame.titleSizeMultiplier || 1)}%`,
                    }}
                  />
                )}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, var(--theme-page-bg), color-mix(in srgb, var(--theme-page-bg) 50%, transparent), transparent)` }}></div>

                {/* Desktop: overlay content on the header image */}
                <div className="absolute bottom-0 left-0 right-0 p-4 hidden md:block">
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <h1
                      className="text-5xl font-bold"
                      style={{
                        color: 'rgb(255, 255, 255)',
                        textShadow: 'rgba(0, 0, 0, 0.85) 3px 3px 0px, rgba(0, 0, 0, 0.7) 6px 6px 3px',
                      }}
                    >
                      {selectedGame.title}
                    </h1>
                    {selectedGame.isPublic === false && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500 text-white flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Not Public
                      </span>
                    )}
                    {selectedGame.pendingApproval && !selectedGame.isPublic && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-black flex items-center gap-1">
                        Pending Approval
                      </span>
                    )}
                    {canEditGame(selectedGame.id) ? (
                      <button
                        onClick={() => { setEditingGame(selectedGame); setIsCreating(false); setIsPreviewing(false); setShowEditor(true); }}
                        className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-black flex items-center gap-1 hover:bg-yellow-400 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit Game
                      </button>
                    ) : (user?.role === 'developer' || user?.role === 'admin') ? (
                      <button
                        onClick={() => { setEditingGame(selectedGame); setIsCreating(false); setIsPreviewing(true); setShowEditor(true); }}
                        className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white flex items-center gap-1 hover:bg-blue-400 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Preview Editor
                      </button>
                    ) : (() => {
                      const match = selectedGame.githubReleaseUrl?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/);
                      if (!match) return null;
                      const issuesUrl = `https://github.com/${match[1]}/issues`;
                      return (
                        <a
                          href={issuesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white flex items-center gap-1 hover:bg-red-400 transition-colors"
                          onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(issuesUrl); } }}
                        >
                          <Bug className="w-3 h-3" /> Bug report
                        </a>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <div className="flex flex-wrap gap-2">
                      {selectedGame.Tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded text-sm"
                          style={{ backgroundColor: 'var(--theme-tag-bg)', color: 'var(--theme-tag-fg)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <StarRating
                      averageRating={gameRatings[selectedGame.id]?.averageRating || 0}
                      totalRatings={gameRatings[selectedGame.id]?.totalRatings || 0}
                      userRating={userRatings[selectedGame.id]}
                      onRate={user ? (stars) => rateGame(selectedGame.id, stars) : undefined}
                      readonly={!user}
                      guestPrompt={!user}
                    />
                    <button
                      onClick={() => toggleFavorite(selectedGame.id)}
                      className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        color: isFavorite(selectedGame.id) ? '#facc15' : 'rgba(255,255,255,0.9)',
                      }}
                      title={isFavorite(selectedGame.id) ? 'Remove from favorites' : 'Add to favorites'}
                      aria-label={isFavorite(selectedGame.id) ? 'Remove from favorites' : 'Add to favorites'}
                      aria-pressed={isFavorite(selectedGame.id)}
                    >
                      <Star className="w-5 h-5" fill={isFavorite(selectedGame.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="flex flex-row items-end justify-between gap-4">
                  <div>
                  {selectedGame.externalLauncherUrl ? (
                    <div className="p-4 rounded-lg shadow bg-[var(--theme-card-bg)]" style={{ backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
                      <a
                        href={selectedGame.externalLauncherUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.externalLauncherUrl!); } }}
                      >
                        <Button className="text-white px-4 py-3 md:px-8 md:py-6 text-sm md:text-lg" style={{ backgroundColor: 'var(--theme-accent)' }}>
                          <ExternalLink className="w-5 h-5 mr-2" />
                          Get Game
                        </Button>
                      </a>
                    </div>
                  ) : isInCEF ? (
                    <div className="p-4 rounded-lg shadow bg-[var(--theme-card-bg)] mb-4" style={{backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)'}}>
                      {extracting ? (
                        /* Extracting / installing state */
                        <div className="w-full max-w-md">
                          <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--theme-accent)' }} />
                            <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Extracting...</span>
                          </div>
                        </div>
                      ) : isoInstalled ? (
                        updating ? (
                          /* Downloading / updating state */
                          <div className="w-full max-w-md">
                            <div className="flex items-center gap-2 mb-2">
                              <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--theme-accent)' }} />
                              <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Updating...</span>
                            </div>
                            <Progress value={downloadProgress} className="h-3 mb-2" style={{ backgroundColor: 'var(--theme-page-bg)' }} />
                            <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{downloadString}</p>
                          </div>
                        ) : exeUpdated ? (
                          /* Selected build is installed and ready to play */
                          <div className="flex flex-wrap gap-3">
                            {isSelectedBuildRunning ? (
                              <Button
                                className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-3 md:px-8 md:py-6 text-sm md:text-lg"
                                onClick={closeRunningGame}
                              >
                                <X className="w-5 h-5 mr-2" />
                                Close
                              </Button>
                            ) : (
                              <Button
                                className="bg-[#5c7e10] hover:bg-[#78a00f] text-white px-4 py-3 md:px-8 md:py-6 text-sm md:text-lg"
                                onClick={() => selectedBuild && requestPlay(selectedBuild)}
                              >
                                <Play className="w-5 h-5 mr-2" />
                                Play
                              </Button>
                            )}
                            {(selectionMismatch || newerReleaseAvailable) && (
                              <Button
                                className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg"
                                onClick={triggerUpdate}
                              >
                                <Download className="w-5 h-5 mr-2" />
                                {selectedBuild ? 'Update' : 'Install'}
                              </Button>
                            )}
                            {newerInstalledBuild && (
                              <Button
                                className="text-white px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg"
                                style={{ backgroundColor: 'var(--theme-accent)' }}
                                onClick={() => switchToInstalledBuild(newerInstalledBuild)}
                              >
                                <RefreshCw className="w-5 h-5 mr-2" />
                                Switch to {newerInstalledBuild.version || newerInstalledBuild.name}
                              </Button>
                            )}
                            {selectedBuild && (
                              <Button
                                className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg"
                                onClick={() => removeBuild(selectedBuild)}
                              >
                                <Trash2 className="w-5 h-5 mr-2" />
                                Uninstall
                              </Button>
                            )}
                            {!selectedGame.disableSaveManager && (
                            <Button
                              className="text-white px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg"
                              style={{ backgroundColor: 'var(--theme-accent)' }}
                              onClick={() => navigate(`/${selectedGame.recompName}/saves`)}
                            >
                              <Save className="w-5 h-5 mr-2" />
                              Manage Saves
                            </Button>
                            )}
                            {/* Vehicle Browser button hidden for now
                            {selectedGame.recompName === 'renut' && (
                            <Button
                              className="text-white px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg"
                              style={{ backgroundColor: 'var(--theme-accent)' }}
                              onClick={() => navigate(`/${selectedGame.recompName}/vehicles`)}
                            >
                              <Car className="w-5 h-5 mr-2" />
                              Vehicle Browser
                            </Button>
                            )}
                            */}
                          </div>
                        ) : (
                          /* Selected build isn't installed yet, or its exe is stale --
                             either way the action installs it into its own build dir
                             without touching any other installed build. */
                          <div className="flex flex-wrap gap-3">
                            <Button
                              className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white px-4 py-3 md:px-8 md:py-6 text-sm md:text-lg"
                              onClick={triggerUpdate}
                            >
                              <Download className="w-5 h-5 mr-2" />
                              {selectedBuild ? 'Update' : 'Install'}
                            </Button>
                            {selectedBuild ? (
                              <Button
                                className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg"
                                onClick={() => removeBuild(selectedBuild)}
                              >
                                <Trash2 className="w-5 h-5 mr-2" />
                                Uninstall
                              </Button>
                            ) : installedBuilds.length === 0 && isoInstalled && (
                              <Button
                                className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg"
                                onClick={removeAssets}
                              >
                                <Trash2 className="w-5 h-5 mr-2" />
                                Remove assets
                              </Button>
                            )}
                          </div>
                        )
                      ) : (
                        <Button
                          className="bg-[#da5d09] hover:bg-[#f18339] text-white px-4 py-3 md:px-8 md:py-6 text-sm md:text-lg"
                          onClick={() => {
                            (window as any).Install(selectedGame.recompName);
                            setExtracting(true);
                            setExtractProgress(0);
                            setExtractString('');
                          }}
                        >
                          <FolderOpen className="w-5 h-5 mr-2" />
                          Select Game Iso
                        </Button>
                      )}
                      {isoInstalled && !extracting && !updating && (
                        <div className="mt-3">
                          <GameVersionPicker
                            game={selectedGame}
                            visibleReleases={visibleReleases}
                            sortedAssets={sortedAssets}
                            selectedTag={selectedTag}
                            selectedAsset={selectedAsset}
                            setSelectedTag={setSelectedTag}
                            setSelectedAsset={setSelectedAsset}
                            showNightlies={showNightlies}
                            setShowNightlies={setShowNightlies}
                            installed={selectedBuild}
                            loading={releasesLoading}
                            error={releasesError}
                            stale={releasesStale}
                            updatedAt={releasesUpdatedAt}
                          />
                          <InstalledBuildsList builds={installedBuilds} onPlay={requestPlay} onClose={closeRunningGame} onRemove={removeBuild} runningBuild={runningBuildForSelectedGame} />
                        </div>
                      )}
                    </div>
                  ) : null}
                  </div>

                  {/* Support + Social Links */}
                  <div className="flex flex-col gap-2 items-end">
                    {(selectedGame.socialLinks?.patreon || selectedGame.socialLinks?.kofi) && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {selectedGame.socialLinks?.patreon && (
                          <a
                            href={selectedGame.socialLinks.patreon}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-[#FF424D] hover:bg-[#e03840] text-white text-sm font-semibold shadow-md transition-colors"
                            title="Support on Patreon"
                            onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.patreon!); } }}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM.003 23.476h4.22V.524H.003v22.952z"/></svg>
                            Patreon
                          </a>
                        )}
                        {selectedGame.socialLinks?.kofi && (
                          <a
                            href={selectedGame.socialLinks.kofi}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-[#29ABE0] hover:bg-[#2299cc] text-white text-sm font-semibold shadow-md transition-colors"
                            title="Support on Ko-fi"
                            onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.kofi!); } }}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/></svg>
                            Ko-fi
                          </a>
                        )}
                      </div>
                    )}
                    {selectedGame.socialLinks && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {selectedGame.socialLinks.discord && (
                          <a href={selectedGame.socialLinks.discord} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#5865F2] hover:bg-[#4752c4] rounded-lg transition-colors" title="Discord" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.discord!); } }}>
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                          </a>
                        )}
                        {selectedGame.socialLinks.twitter && (
                          <a href={selectedGame.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#1DA1F2] hover:bg-[#1a8cd8] rounded-lg transition-colors" title="Twitter" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.twitter!); } }}>
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                          </a>
                        )}
                        {selectedGame.socialLinks.bluesky && (
                          <a href={selectedGame.socialLinks.bluesky} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0085ff] hover:bg-[#0070dd] rounded-lg transition-colors" title="Bluesky" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.bluesky!); } }}>
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.6 3.476 6.278 3.087-4.787.91-6.004 3.407-3.318 5.921C6.345 21.828 9.702 21.25 12 18.904c2.298 2.346 5.655 2.924 8.416.35 2.686-2.513 1.469-5.01-3.318-5.92 2.677.389 5.493-.46 6.278-3.088C23.622 9.419 24 4.459 24 3.768c0-.688-.139-1.86-.902-2.203-.659-.3-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>
                          </a>
                        )}
                        {selectedGame.socialLinks.youtube && (
                          <a href={selectedGame.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#FF0000] hover:bg-[#cc0000] rounded-lg transition-colors" title="YouTube" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.youtube!); } }}>
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          </a>
                        )}
                        {selectedGame.socialLinks.website && (
                          <a href={selectedGame.socialLinks.website} target="_blank" rel="noopener noreferrer" className="p-3 rounded-lg transition-colors" style={{ backgroundColor: 'var(--theme-item-selected)' }} title="Website" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.website!); } }}>
                            <Globe className="w-5 h-5 text-white" />
                          </a>
                        )}
                        {selectedGame.socialLinks.github && (
                          <a href={selectedGame.socialLinks.github} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#333] hover:bg-[#555] rounded-lg transition-colors" title="GitHub" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.github!); } }}>
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                          </a>
                        )}
                        {selectedGame.socialLinks.reddit && (
                          <a href={selectedGame.socialLinks.reddit} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#FF4500] hover:bg-[#e03d00] rounded-lg transition-colors" title="Reddit" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.reddit!); } }}>
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.053 1.597a3.45 3.45 0 0 1 .042.52c0 2.694-3.13 4.884-7.005 4.884-3.875 0-7.005-2.19-7.005-4.884a3.6 3.6 0 0 1 .043-.524A1.745 1.745 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 0-.463.327.327 0 0 0-.462 0c-.545.533-1.684.73-2.512.73-.828 0-1.953-.197-2.498-.73a.327.327 0 0 0-.232-.095z"/></svg>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              </div>

              {/* Mobile: game info below the header image */}
              <div className="md:hidden p-4 relative z-10 space-y-4" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1
                    className="text-2xl font-bold"
                    style={{
                      color: 'rgb(255, 255, 255)',
                      textShadow: 'rgba(0, 0, 0, 0.85) 3px 3px 0px, rgba(0, 0, 0, 0.7) 6px 6px 3px',
                    }}
                  >
                    {selectedGame.title}
                  </h1>
                  {selectedGame.isPublic === false && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Not Public
                    </span>
                  )}
                  {selectedGame.pendingApproval && !selectedGame.isPublic && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1">
                      Pending Approval
                    </span>
                  )}
                  {canEditGame(selectedGame.id) ? (
                    <button
                      onClick={() => { setEditingGame(selectedGame); setIsCreating(false); setIsPreviewing(false); setShowEditor(true); }}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1 hover:bg-yellow-400 transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  ) : (user?.role === 'developer' || user?.role === 'admin') ? (
                    <button
                      onClick={() => { setEditingGame(selectedGame); setIsCreating(false); setIsPreviewing(true); setShowEditor(true); }}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white flex items-center gap-1 hover:bg-blue-400 transition-colors"
                    >
                      <Eye className="w-3 h-3" /> Preview
                    </button>
                  ) : (() => {
                    const match = selectedGame.githubReleaseUrl?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/);
                    if (!match) return null;
                    const issuesUrl = `https://github.com/${match[1]}/issues`;
                    return (
                      <a
                        href={issuesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white flex items-center gap-1 hover:bg-red-400 transition-colors"
                        onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(issuesUrl); } }}
                      >
                        <Bug className="w-3 h-3" /> Bug report
                      </a>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGame.Tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: 'var(--theme-tag-bg)', color: 'var(--theme-tag-fg)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <StarRating
                    averageRating={gameRatings[selectedGame.id]?.averageRating || 0}
                    totalRatings={gameRatings[selectedGame.id]?.totalRatings || 0}
                    userRating={userRatings[selectedGame.id]}
                    onRate={user ? (stars) => rateGame(selectedGame.id, stars) : undefined}
                    readonly={!user}
                    guestPrompt={!user}
                  />
                  {selectedGame.socialLinks?.patreon && (
                    <a
                      href={selectedGame.socialLinks.patreon}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-[#FF424D] hover:bg-[#e03840] text-white text-xs font-semibold shadow-md transition-colors"
                      title="Support on Patreon"
                      onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.patreon!); } }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM.003 23.476h4.22V.524H.003v22.952z"/></svg>
                      Patreon
                    </a>
                  )}
                  {selectedGame.socialLinks?.kofi && (
                    <a
                      href={selectedGame.socialLinks.kofi}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-[#29ABE0] hover:bg-[#2299cc] text-white text-xs font-semibold shadow-md transition-colors"
                      title="Support on Ko-fi"
                      onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.kofi!); } }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/></svg>
                      Ko-fi
                    </a>
                  )}
                </div>
                {selectedGame.externalLauncherUrl ? (
                  <a
                    href={selectedGame.externalLauncherUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.externalLauncherUrl!); } }}
                  >
                    <Button className="text-white px-4 py-3 text-sm" style={{ backgroundColor: 'var(--theme-accent)' }}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Get Game
                    </Button>
                  </a>
                ) : isInCEF ? (
                  <div>
                    {extracting ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--theme-accent)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Extracting...</span>
                      </div>
                    ) : isoInstalled ? (
                      updating ? (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--theme-accent)' }} />
                            <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Updating...</span>
                          </div>
                          <Progress value={downloadProgress} className="h-2 mb-1" style={{ backgroundColor: 'var(--theme-page-bg)' }} />
                          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{downloadString}</p>
                        </div>
                      ) : exeUpdated ? (
                        <div className="flex flex-wrap gap-2">
                          {isSelectedBuildRunning ? (
                            <Button className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-2 text-sm" onClick={closeRunningGame}>
                              <X className="w-4 h-4 mr-1" /> Close
                            </Button>
                          ) : (
                            <Button className="bg-[#5c7e10] hover:bg-[#78a00f] text-white px-4 py-2 text-sm" onClick={() => selectedBuild && requestPlay(selectedBuild)}>
                              <Play className="w-4 h-4 mr-1" /> Play
                            </Button>
                          )}
                          {(selectionMismatch || newerReleaseAvailable) && (
                            <Button className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white px-4 py-2 text-sm" onClick={triggerUpdate}>
                              <Download className="w-4 h-4 mr-1" /> {selectedBuild ? 'Update' : 'Install'}
                            </Button>
                          )}
                          {newerInstalledBuild && (
                            <Button
                              className="text-white px-4 py-2 text-sm"
                              style={{ backgroundColor: 'var(--theme-accent)' }}
                              onClick={() => switchToInstalledBuild(newerInstalledBuild)}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" /> Switch to {newerInstalledBuild.version || newerInstalledBuild.name}
                            </Button>
                          )}
                          {selectedBuild && (
                            <Button className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-2 text-sm" onClick={() => removeBuild(selectedBuild)}>
                              <Trash2 className="w-4 h-4 mr-1" /> Uninstall
                            </Button>
                          )}
                          {!selectedGame.disableSaveManager && (
                            <Button className="text-white px-4 py-2 text-sm" style={{ backgroundColor: 'var(--theme-accent)' }} onClick={() => navigate(`/${selectedGame.recompName}/saves`)}>
                              <Save className="w-4 h-4 mr-1" /> Saves
                            </Button>
                          )}
                          {/* Vehicles button hidden for now
                          {selectedGame.recompName === 'renut' && (
                            <Button className="text-white px-4 py-2 text-sm" style={{ backgroundColor: 'var(--theme-accent)' }} onClick={() => navigate(`/${selectedGame.recompName}/vehicles`)}>
                              <Car className="w-4 h-4 mr-1" /> Vehicles
                            </Button>
                          )}
                          */}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white px-4 py-2 text-sm" onClick={triggerUpdate}>
                            <Download className="w-4 h-4 mr-1" /> {selectedBuild ? 'Update' : 'Install'}
                          </Button>
                          {selectedBuild ? (
                            <Button className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-2 text-sm" onClick={() => removeBuild(selectedBuild)}>
                              <Trash2 className="w-4 h-4 mr-1" /> Uninstall
                            </Button>
                          ) : installedBuilds.length === 0 && isoInstalled && (
                            <Button className="bg-[#8b1a1a] hover:bg-[#a52525] text-white px-4 py-2 text-sm" onClick={removeAssets}>
                              <Trash2 className="w-4 h-4 mr-1" /> Remove assets
                            </Button>
                          )}
                        </div>
                      )
                    ) : (
                      <Button className="bg-[#da5d09] hover:bg-[#f18339] text-white px-4 py-2 text-sm" onClick={() => { (window as any).Install(selectedGame.recompName); setExtracting(true); setExtractProgress(0); setExtractString(''); }}>
                        <FolderOpen className="w-4 h-4 mr-1" /> Select Game Iso
                      </Button>
                    )}
                    {isoInstalled && !extracting && !updating && (
                      <div className="mt-3">
                        <GameVersionPicker
                          compact
                          game={selectedGame}
                          visibleReleases={visibleReleases}
                          sortedAssets={sortedAssets}
                          selectedTag={selectedTag}
                          selectedAsset={selectedAsset}
                          setSelectedTag={setSelectedTag}
                          setSelectedAsset={setSelectedAsset}
                          showNightlies={showNightlies}
                          setShowNightlies={setShowNightlies}
                          installed={selectedBuild}
                          loading={releasesLoading}
                          error={releasesError}
                          stale={releasesStale}
                          updatedAt={releasesUpdatedAt}
                        />
                        <InstalledBuildsList builds={installedBuilds} onPlay={requestPlay} onClose={closeRunningGame} onRemove={removeBuild} runningBuild={runningBuildForSelectedGame} compact />
                      </div>
                    )}
                  </div>
                ) : null}
                {selectedGame.socialLinks && (
                  <div className="flex flex-wrap gap-2">
                    {selectedGame.socialLinks.discord && (
                      <a href={selectedGame.socialLinks.discord} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#5865F2] hover:bg-[#4752c4] rounded-lg transition-colors" title="Discord" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.discord!); } }}>
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                      </a>
                    )}
                    {selectedGame.socialLinks.github && (
                      <a href={selectedGame.socialLinks.github} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#333] hover:bg-[#555] rounded-lg transition-colors" title="GitHub" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.github!); } }}>
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                      </a>
                    )}
                    {selectedGame.socialLinks.twitter && (
                      <a href={selectedGame.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] rounded-lg transition-colors" title="Twitter" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.twitter!); } }}>
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                    )}
                    {selectedGame.socialLinks.youtube && (
                      <a href={selectedGame.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#FF0000] hover:bg-[#cc0000] rounded-lg transition-colors" title="YouTube" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.youtube!); } }}>
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      </a>
                    )}
                    {selectedGame.socialLinks.website && (
                      <a href={selectedGame.socialLinks.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg transition-colors" style={{ backgroundColor: 'var(--theme-item-selected)' }} title="Website" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(selectedGame.socialLinks!.website!); } }}>
                        <Globe className="w-4 h-4 text-white" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 md:p-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
                  {/* Main Content */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* About */}
                    <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>About This Game</h2>
                        {canEditGame(selectedGame.id) && (
                          <button
                            onClick={() => { setDescriptionDraft(selectedGame.description); setEditingDescription(true); }}
                            className="p-1.5 rounded hover:opacity-80 transition-opacity"
                            style={{ color: 'var(--theme-text-muted)' }}
                            title="Edit description"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div style={{ color: 'var(--theme-text-secondary)' }}>
                        <Markdown source={selectedGame.description} className="leading-relaxed" />
                      </div>
                    </div>
                    {/* Media Carousel */}
                    {selectedGame.mediaLinks && selectedGame.mediaLinks.length > 0 && (
                      <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
                        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--theme-text-primary)' }}>Media</h2>
                        <Carousel className="w-full max-w-2xl mx-auto">
                          <CarouselContent>
                            {selectedGame.mediaLinks.map((link, idx) => (
                              <CarouselItem key={idx} className="flex items-center justify-center h-52 md:h-96 bg-black/20 rounded-lg overflow-hidden">
                                {link.match(/(youtube\.com|youtu\.be)/i) ? (
                                  <iframe
                                    width="100%"
                                    height="100%"
                                    src={
                                      link.includes('embed')
                                        ? link
                                        : link.replace('watch?v=', 'embed/')
                                    }
                                    title="YouTube video player"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-full h-full border-0 rounded-lg"
                                  />
                                ) : (
                                  <img
                                    src={link}
                                    alt={`Media ${idx + 1}`}
                                    className="object-contain w-full h-full rounded-lg"
                                  />
                                )}
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          <div className="flex justify-between mt-2">
                            <CarouselPrevious />
                            <CarouselNext />
                          </div>
                        </Carousel>
                      </div>
                    )}
                    {/* Related News */}
                    <GameNewsSection
                      posts={newsPosts.filter(p => p.recompId === selectedGame.id)}
                    />
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Game Info */}
                    <div className="p-6 rounded" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
                      <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--theme-text-primary)' }}>Game Info</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Original Developer</div>
                          <div style={{ color: 'var(--theme-text-primary)' }}>{selectedGame.og_developer}</div>
                        </div>
                        <div>
                          <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Recompiled By</div>
                          <div style={{ color: 'var(--theme-text-primary)' }}>{selectedGame.recompiled_developers.join(', ')}</div>
                        </div>
                        <div>
                          <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Status</div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusColors[selectedGame.status]} cursor-default`}>
                                {selectedGame.status}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{statusDescriptions[selectedGame.status]}</TooltipContent>
                          </Tooltip>
                        </div>
                        {selectedGame.xexVersion && (
                          <div>
                            <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>XEX Version</div>
                            <div style={{ color: 'var(--theme-text-primary)' }}>{selectedGame.xexVersion}</div>
                          </div>
                        )}
                        {selectedGame.xexSha256 && (
                          <div>
                            <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>XEX SHA256</div>
                            <div
                              className="font-mono text-xs break-all select-all"
                              style={{ color: 'var(--theme-text-primary)' }}
                              title={selectedGame.xexSha256}
                            >
                              {selectedGame.xexSha256}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Settings (CVars) */}
                    {selectedGame.cvars && selectedGame.cvars.length > 0 && (
                      <div className="p-6 rounded" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
                        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                          <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Settings</h3>
                          {!isInCEF && (
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-muted)' }}>
                              launcher only
                            </span>
                          )}
                        </div>
                        <div className="space-y-4">
                          {selectedGame.cvars.map(cv => {
                            const value = getCvarValue(cv);
                            return (
                              <div key={cv.id} style={{ opacity: isInCEF ? 1 : 0.7 }}>
                                <div className="flex items-center justify-between gap-3 mb-1">
                                  <label className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }} htmlFor={`cvar-${cv.id}`}>
                                    {cv.displayName || cv.tag}
                                  </label>
                                  {cv.type === 'Bool' ? (
                                    <label className={`relative inline-flex items-center ${isInCEF ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                                      <input
                                        id={`cvar-${cv.id}`}
                                        type="checkbox"
                                        checked={Boolean(value)}
                                        onChange={e => setCvarValue(cv.id, e.target.checked)}
                                        disabled={!isInCEF}
                                        className="sr-only peer"
                                      />
                                      <div
                                        className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                                        style={{ backgroundColor: value ? 'var(--theme-accent)' : 'var(--theme-item-selected)' }}
                                      />
                                    </label>
                                  ) : (
                                    <input
                                      id={`cvar-${cv.id}`}
                                      type="number"
                                      step={cv.type === 'Float' ? 'any' : 1}
                                      value={Number(value)}
                                      onChange={e => {
                                        const n = e.target.value === '' ? 0 : Number(e.target.value);
                                        if (!isFinite(n)) return;
                                        setCvarValue(cv.id, cv.type === 'Int' ? Math.trunc(n) : n);
                                      }}
                                      disabled={!isInCEF}
                                      className="w-32 rounded-md px-2 py-1 text-sm border outline-none text-right disabled:cursor-not-allowed"
                                      style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                                    />
                                  )}
                                </div>
                                {cv.description && (
                                  <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{cv.description}</p>
                                )}
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
                                    -{cv.tag} <span className="opacity-60">({cv.type})</span>
                                  </span>
                                  {isInCEF && (
                                    <button
                                      type="button"
                                      onClick={() => resetCvar(cv.id)}
                                      className="text-[10px] underline"
                                      style={{ color: 'var(--theme-text-muted)' }}
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full relative z-10">
              <p className="text-lg" style={{ color: 'var(--theme-text-muted)' }}>Select a game to view details</p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Hidden background audio player */}
      {chosenAudioUrl && (() => {
        const videoId = getYouTubeVideoId(chosenAudioUrl);
        if (!videoId) return null;
        return (
          <BackgroundAudioPlayer
            key={`${selectedGame?.id}-${audioKey}`}
            videoId={videoId}
            audioKey={audioKey}
            volume={10}
            muted={audioMuted}
          />
        );
      })()}

      {/* Description Editor Modal */}
      {editingDescription && selectedGame && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="rounded-lg border w-full max-w-3xl flex flex-col" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Edit Description</h2>
              <div className="flex items-center gap-2">
                <Link
                  to="/markdown-reference"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline"
                  style={{ color: 'var(--theme-accent)' }}
                  onClick={(e) => {
                    if (isInLauncher()) {
                      e.preventDefault();
                      openExternalUrl(`${window.location.origin}/#/markdown-reference`);
                    }
                  }}
                >
                  Markdown reference ↗
                </Link>
                <button onClick={() => setEditingDescription(false)} style={{ color: 'var(--theme-text-muted)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              <textarea
                value={descriptionDraft}
                onChange={e => setDescriptionDraft(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-none font-mono"
                style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', height: '60vh', minHeight: '300px' }}
                placeholder="Game description..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <Button type="button" onClick={() => setEditingDescription(false)} style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}>
                Cancel
              </Button>
              <Button
                type="button"
                className="text-white"
                style={{ backgroundColor: 'var(--theme-accent)' }}
                onClick={async () => {
                  await saveGame({ ...selectedGame, description: descriptionDraft });
                  setEditingDescription(false);
                }}
              >
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Game Editor Modal */}
      {showEditor && (
        <GameEditor
          game={editingGame}
          isNew={isCreating}
          readOnly={isPreviewing}
          onSave={async (game) => {
            await saveGame(game);
            // Auto-assign developer to game they create
            if (isCreating && user?.role === 'developer') {
              await assignGame(user.uid, game.id);
            }
            setShowEditor(false);
            setSelectedGameId(game.id);
          }}
          onDelete={(id) => { deleteGame(id); setShowEditor(false); setSelectedGameId(null); }}
          onClose={() => { setShowEditor(false); setIsPreviewing(false); }}
        />
      )}

      {/* Confirm closing the running game before launching a different one */}
      <Dialog open={!!pendingPlayBuild} onOpenChange={(o) => { if (!o) setPendingPlayBuild(null); }}>
        <DialogContent
          className="sm:max-w-md"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Close the running game?</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
              {runningGame ? `${runningGame.game} is currently running. ` : ''}
              Launching this game will close it first, and any unsaved progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setPendingPlayBuild(null)}
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCloseAndPlay}
              className="gap-2 bg-[#8b1a1a] hover:bg-[#a52525] text-white border-0"
            >
              <X className="w-4 h-4" />
              Close & Play
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Related News (per-game) ---------------- */

function formatNewsDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function GameNewsSection({ posts }: { posts: import('../data/useNews').NewsPost[] }) {
  if (!posts || posts.length === 0) return null;
  // Sort by effective publication date (admin override) falling back to createdAt.
  const ordered = [...posts].sort((a, b) => {
    const da = a.publishedAt ?? a.createdAt;
    const db = b.publishedAt ?? b.createdAt;
    return db - da;
  });
  return (
    <div
      className="p-6 rounded-lg shadow"
      style={{
        backgroundColor: 'var(--theme-card-bg)',
        backdropFilter: 'var(--theme-backdrop-blur)',
        WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
      }}
    >
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
        <Newspaper className="w-5 h-5" /> News
      </h2>
      <div className="space-y-6">
        {ordered.map((post) => (
          <GameNewsHeader key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

function GameNewsHeader({ post }: { post: import('../data/useNews').NewsPost }) {
  const images = (post.thumbnails && post.thumbnails.length > 0)
    ? post.thumbnails
    : (post.thumbnail ? [post.thumbnail] : []);
  const [imgIdx, setImgIdx] = useState(0);
  const displayDate = post.publishedAt ?? post.createdAt;
  const tags = post.tags || [];
  const cover = images[imgIdx];
  return (
    <article
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-page-bg)' }}
    >
      {cover && (
        <div className="relative w-full" style={{ aspectRatio: '21 / 9', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <img
            key={imgIdx}
            src={cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-x-0 bottom-0 p-4 md:p-6"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 100%)',
              color: '#fff',
            }}
          >
            <h3 className="text-xl md:text-3xl font-bold leading-tight drop-shadow">
              {post.title || 'Untitled'}
            </h3>
            <div className="text-xs md:text-sm opacity-90 mt-1">
              {formatNewsDate(displayDate)}
              {post.authorName ? ` • ${post.authorName}` : ''}
            </div>
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                aria-label="Previous image"
                className="absolute top-1/2 -translate-y-1/2 left-2 p-1.5 rounded-full hover:opacity-90"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                aria-label="Next image"
                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-full hover:opacity-90"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    aria-label={`Go to image ${i + 1}`}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#fff', opacity: i === imgIdx ? 1 : 0.45 }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="p-4 md:p-6">
        {!cover && (
          <header className="mb-3">
            <h3 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
              {post.title || 'Untitled'}
            </h3>
            <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              {formatNewsDate(displayDate)}
              {post.authorName ? ` • ${post.authorName}` : ''}
            </div>
          </header>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded text-[11px] font-medium"
                style={{
                  backgroundColor: 'var(--theme-item-selected)',
                  color: 'var(--theme-text-primary)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div style={{ color: 'var(--theme-text-secondary)' }}>
          <Markdown source={post.body || ''} />
        </div>
      </div>
    </article>
  );
}