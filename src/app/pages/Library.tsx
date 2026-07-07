import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { GameList } from '../components/GameList';
import { TopBar } from '../components/TopBar';
import { Sidebar, SIDEBAR_WIDTH_CLASS } from '../components/Sidebar';
import { Pencil, ArrowLeft } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router';
import { Game, Platform } from '../types/game';
import { useAuth } from '../auth/AuthContext';
import { useGameStore } from '../data/GameStore';
import { useFocusedGame } from '../data/FocusedGameContext';
import { useRatings } from '../data/useRatings';
import { useFavorites } from '../data/useFavorites';
import { usePlaytime } from '../data/usePlaytime';
import { useCvarSettings } from '../data/useCvarSettings';
import { useTheme } from '../theme/ThemeContext';
import { useBackgroundAccent } from '../theme/BackgroundAccentContext';
import { useXMBAccentVars } from '../hooks/useXMBAccentVars';
import { useHeaderCrossfade } from '../hooks/useHeaderCrossfade';
import { useGameInstallation } from '../hooks/useGameInstallation';
import { useRunningGame } from '../hooks/useRunningGame';
import { BackgroundAudioPlayer } from '../components/BackgroundAudioPlayer';
import { Markdown } from '../components/Markdown';
import { useNews } from '../data/useNews';
import { buildReleaseDownloadPrefix, pickDefaultAsset, sortAssetsByRelevance, detectAssetPlatform, isPlatformCompatible, isArchCompatible, findInstalledBuild, useGameReleases } from '../data/useGameReleases';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';
import { isInLauncher, isInTauriLauncher } from '../utils/externalLink';
import { GameInfoSidebar } from '../components/GameInfoSidebar';
import { GameNewsSection } from '../components/GameNewsSection';
import { DescriptionEditorModal } from '../components/DescriptionEditorModal';
import { LibraryBanners } from '../components/LibraryBanners';
import { GameDetailHeader } from '../components/GameDetailHeader';
import { GameMediaCarousel } from '../components/GameMediaCarousel';
import { ConfirmCloseGameDialog } from '../components/ConfirmCloseGameDialog';
import { ConfirmRemoveBuildDialog } from '../components/ConfirmRemoveBuildDialog';
import { ExtractErrorDialog } from '../components/ExtractErrorDialog';
import { GameManageModal } from '../components/GameManageModal';

export function Library() {
  const { recompName: urlRecompName } = useParams<{ recompName: string }>();
  const navigate = useNavigate();
  const { user, canEditGame } = useAuth();
  const { games, saveGame, getVisibleGames } = useGameStore();
  const { gameRatings, userRatings, rateGame } = useRatings(user?.uid);
  const { isFavorite, toggleFavorite, favorites, reorderFavorites } = useFavorites(user?.uid);
  const { getPlaytime } = usePlaytime();
  const { posts: newsPosts } = useNews();
  const { theme } = useTheme();
  const { setAccentColor } = useBackgroundAccent();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<Game['status'][]>(['Featured', 'Enhanced', 'Playable', 'Gameplay', 'Loads']);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [hideExternal, setHideExternal] = useState(false);
  const [platformFilters, setPlatformFilters] = useState<Platform[]>([]);
  const [audioKey, setAudioKey] = useState(0);
  const [audioMuted, setAudioMuted] = useState(() => {
    try { return localStorage.getItem('goopie:audioMuted') === '1'; } catch { return false; }
  });
  const isTauri = isInTauriLauncher();
  const isLegacyLauncher = isInLauncher() && !isTauri;
  const [chosenAudioUrl, setChosenAudioUrl] = useState<string | undefined>(undefined);
  const [isInCEF, setIsInCEF] = useState(false);
  const [infoBannerDismissed, setInfoBannerDismissed] = useState(() => {
    try { return localStorage.getItem('goopie:infoBannerDismissed') === '1'; } catch { return false; }
  });
  const [legacyBannerDismissed, setLegacyBannerDismissed] = useState(() => {
    try { return localStorage.getItem('goopie:legacyLauncherBannerDismissed') === '1'; } catch { return false; }
  });
  const [editingDescription, setEditingDescription] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  // Set right before opening the Manage modal from a blocked Play attempt
  // (see useRunningGame's onModsInvalid below), so it lands on the Mods tab
  // instead of whatever tab was last open.
  const [manageModalInitialTab, setManageModalInitialTab] = useState<'mods' | undefined>(undefined);
  const [pendingRemoveBuild, setPendingRemoveBuild] = useState<{ name: string; version?: string; asset?: string } | null>(null);
  const appliedUrlRef = useMemo(() => ({ current: undefined as string | undefined }), []);

  const visibleGames = useMemo(() => {
    return getVisibleGames(user?.role, user?.assignedGames || []);
  }, [games, user, getVisibleGames]);

  const statusOrder: Record<Game['status'], number> = {
    Featured: 0, Enhanced: 1, Playable: 2, Gameplay: 3, Loads: 4, Unplayable: 5, Unknown: 6,
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    visibleGames.forEach(game => game.Tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [visibleGames]);

  const filteredGames = useMemo(() => {
    let totalSum = 0;
    let totalCount = 0;
    for (const info of Object.values(gameRatings)) {
      totalSum += info.averageRating * info.totalRatings;
      totalCount += info.totalRatings;
    }
    const C = totalCount > 0 ? totalSum / totalCount : 0;
    const m = 3;

    const favOrder = new Map<string, number>();
    favorites.forEach((id, i) => favOrder.set(id, i));

    return visibleGames
      .filter(game => {
        const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            game.og_developer.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        if (favOrder.has(game.id)) return true;
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(game.status);
        const matchesTags = tagFilters.length === 0 || tagFilters.some(tag => game.Tags.includes(tag));
        const matchesExternal = !hideExternal || !game.externalLauncherUrl;
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

  // Publish the selected game to the global drop handler (mounted above the
  // router, so it can't read our local `selectedGameId`) — see
  // FocusedGameContext for why. Cleared on unmount so a drop on some other
  // route (e.g. Settings) isn't mistakenly attributed to the last-viewed game.
  const { setFocusedGame } = useFocusedGame();
  useEffect(() => {
    setFocusedGame(selectedGame?.recompName ?? null);
    return () => setFocusedGame(null);
  }, [selectedGame?.recompName, setFocusedGame]);

  // Pull the latest cloud save (if enabled for this game) whenever its page
  // is opened — a no-op on the Rust side (no network call at all) unless
  // cloud saves are actually enabled, see `cloud_saves::sync_on_open`. The
  // matching push happens automatically when the game closes.
  useEffect(() => {
    const recompName = selectedGame?.recompName;
    if (!recompName) return;
    if (!isLauncherVersionAtLeast('1.6.1')) return;
    const w = window as any;
    if (typeof w.syncCloudSaveOnOpen === 'function') {
      w.syncCloudSaveOnOpen(recompName);
    }
  }, [selectedGame?.recompName]);

  const { getValue: getCvarValue, setValue: setCvarValue, reset: resetCvar, buildArgs: buildCvarArgs, buildTypes: buildCvarTypes } =
    useCvarSettings(selectedGame?.id, selectedGame?.cvars);

  const releasesState = useGameReleases(selectedGame);
  const {
    repo: githubRepo,
    releases: allReleases,
    visibleReleases,
    compatibleAssets,
    noCompatibleBuilds,
    showNightlies,
    setShowNightlies,
    showIncompatible,
    setShowIncompatible,
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
    protonReady,
  } = releasesState;

  // --- Custom hooks ---

  const headerImages = useMemo(() => {
    if (!selectedGame) return [];
    return Array.isArray(selectedGame.headerImage) ? selectedGame.headerImage : [selectedGame.headerImage];
  }, [selectedGame]);

  const crossfade = useHeaderCrossfade(selectedGame?.id, headerImages);

  const installation = useGameInstallation({
    selectedGame,
    selectedTag,
    selectedAsset,
    isInCEF,
  });

  const runningGameHook = useRunningGame({
    selectedGame,
    buildCvarArgs,
    buildCvarTypes,
    setAudioMuted,
    // The Play button is never disabled for a broken mod layout — instead,
    // routing straight to the Mods tab (with its "Fix" auto-sort action) is
    // far more actionable than a plain error banner would be.
    onModsInvalid: () => {
      setManageModalInitialTab('mods');
      setShowManageModal(true);
    },
  });

  // --- Auto-play from --play CLI flag ---
  const autoPlayRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // First render: read the auto-play flag once.
    if (autoPlayRef.current === undefined) {
      const w = window as any;
      const game = typeof w.getAutoPlayGame === 'function' ? w.getAutoPlayGame() : null;
      autoPlayRef.current = game || null;
      if (game) {
        // Select the game so builds load.
        const found = visibleGames.find(g => g.recompName === game);
        if (found) setSelectedGameId(found.id);
      }
    }
  }, [visibleGames]);

  useEffect(() => {
    if (!autoPlayRef.current) return;
    if (!selectedGame || selectedGame.recompName !== autoPlayRef.current) return;
    if (installation.installedBuilds.length === 0) return;
    // We have the game selected and a build available — trigger play.
    const build = findInstalledBuild(installation.installedBuilds, selectedTag, selectedAsset)
      ?? installation.installedBuilds[0];
    autoPlayRef.current = null;
    const w = window as any;
    if (typeof w.clearAutoPlayGame === 'function') w.clearAutoPlayGame();
    runningGameHook.requestPlay(build);
  }, [selectedGame, installation.installedBuilds, selectedTag, selectedAsset, runningGameHook]);

  // --- Derived state from installation + releases ---

  const selectedBuild = useMemo(
    () => findInstalledBuild(installation.installedBuilds, selectedTag, selectedAsset),
    [installation.installedBuilds, selectedTag, selectedAsset],
  );

  const releaseDownloadPrefix = useMemo(() => {
    if (!githubRepo || !selectedTag) return selectedGame?.githubReleaseUrl ?? '';
    return buildReleaseDownloadPrefix(githubRepo, selectedTag);
  }, [githubRepo, selectedTag, selectedGame?.githubReleaseUrl]);

  const canInstall = !!(githubRepo || selectedGame?.githubReleaseUrl);

  const selectionMismatch = useMemo(() => {
    if (installation.installedBuilds.length === 0) return false;
    return !selectedBuild;
  }, [installation.installedBuilds, selectedBuild]);

  const latestChannelTag = useMemo(() => {
    if (!selectedBuild?.version) return null;
    if (selectedTag && selectedBuild.version !== selectedTag) return null;
    const installedIsNightly = allReleases.find(r => r.tag === selectedBuild.version)?.prerelease ?? false;
    const candidates = allReleases.filter(r => r.prerelease === installedIsNightly);
    return candidates[0]?.tag ?? null;
  }, [selectedBuild, selectedTag, allReleases]);

  const newerInstalledBuild = useMemo(() => {
    if (!latestChannelTag || latestChannelTag === selectedBuild?.version) return null;
    return installation.installedBuilds.find(b => b.version === latestChannelTag) ?? null;
  }, [latestChannelTag, selectedBuild, installation.installedBuilds]);

  const newerReleaseAvailable = useMemo(() => {
    if (!latestChannelTag || !selectedBuild?.version) return false;
    return latestChannelTag !== selectedBuild.version && !newerInstalledBuild;
  }, [latestChannelTag, selectedBuild, newerInstalledBuild]);

  const switchToInstalledBuild = useCallback((build: { version?: string; asset?: string }) => {
    setSelectedTag(build.version);
    setSelectedAsset(build.asset);
  }, [setSelectedTag, setSelectedAsset]);

  const updateInfo = useMemo(() => {
    if (newerReleaseAvailable && githubRepo && selectedGame) {
      const installedIsNightly = allReleases.find(r => r.tag === selectedBuild?.version)?.prerelease ?? false;
      const target = allReleases.filter(r => r.prerelease === installedIsNightly)[0];
      if (target) {
        let targetSorted = sortAssetsByRelevance(target.assets, launcherPlatform, launcherArch);
        if (launcherPlatform && isLauncherVersionAtLeast('1.3.0')) {
          const compatible = targetSorted.filter(a => isPlatformCompatible(detectAssetPlatform(a.name), launcherPlatform, protonReady));
          if (compatible.length > 0) targetSorted = compatible;
        }
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
    if (newerReleaseAvailable && updateInfo.tag) {
      setSelectedTag(updateInfo.tag);
    }
    installation.setUpdating(true);
  }, [selectedGame, updateInfo, newerReleaseAvailable, setSelectedTag, installation]);

  const removeBuild = useCallback((build: { name: string; version?: string; asset?: string }) => {
    setPendingRemoveBuild(build);
  }, []);

  const confirmRemoveBuild = useCallback(() => {
    if (!selectedGame || !pendingRemoveBuild) return;
    const w = window as any;
    if (typeof w.Uninstall !== 'function') return;
    w.Uninstall(selectedGame.recompName, pendingRemoveBuild.name);
    if (selectedBuild?.name === pendingRemoveBuild.name) {
      const remaining = installation.installedBuilds.filter(b => b.name !== pendingRemoveBuild.name);
      const next = remaining[0] ?? null;
      setSelectedTag(next?.version);
      setSelectedAsset(next?.asset);
    }
    installation.checkState();
    setPendingRemoveBuild(null);
  }, [selectedGame, pendingRemoveBuild, selectedBuild, setSelectedTag, setSelectedAsset, installation]);

  const removeAssets = useCallback((force?: boolean) => {
    if (!selectedGame) return;
    const w = window as any;
    if (force) {
      if (installation.updateInstalled && typeof w.RemoveUpdate === 'function') {
        w.RemoveUpdate(selectedGame.recompName);
      }
      if (installation.dlcInstalled && typeof w.getInstalledDlc === 'function' && typeof w.RemoveDlc === 'function') {
        const raw = w.getInstalledDlc(selectedGame.recompName);
        const dlc = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
        for (const d of dlc) {
          w.RemoveDlc(selectedGame.recompName, d.title_id, d.hash);
        }
      }
    }
    if (typeof w.RemoveAssets !== 'function') return;
    w.RemoveAssets(selectedGame.recompName);
    installation.checkState();
  }, [selectedGame, installation]);

  // --- Audio ---

  useEffect(() => {
    if (!selectedGame) { setChosenAudioUrl(undefined); return; }
    if (chosenAudioUrl !== undefined) return;
    if (selectedGame.backgroundAudio) {
      const urls = Array.isArray(selectedGame.backgroundAudio) ? selectedGame.backgroundAudio : [selectedGame.backgroundAudio];
      setChosenAudioUrl(urls.length > 0 ? urls[Math.floor(Math.random() * urls.length)] : undefined);
    }
  }, [selectedGame?.id]);

  // --- CEF detection ---

  useEffect(() => {
    const w = window as any;
    if (w.getVersion) {
      const version = w.getVersion();
      setIsInCEF(typeof version === 'string');
    }
  }, []);

  // --- Theme ---

  useXMBAccentVars(theme, selectedGame?.accentColor);

  useEffect(() => {
    setAccentColor(selectedGame?.accentColor);
    return () => setAccentColor(undefined);
  }, [selectedGame?.accentColor, setAccentColor]);

  // --- LocalStorage persistence ---

  useEffect(() => {
    try { localStorage.setItem('goopie:audioMuted', audioMuted ? '1' : '0'); } catch { /* quota */ }
  }, [audioMuted]);

  useEffect(() => {
    try { localStorage.setItem('goopie:infoBannerDismissed', infoBannerDismissed ? '1' : '0'); } catch { /* quota */ }
  }, [infoBannerDismissed]);

  useEffect(() => {
    try { localStorage.setItem('goopie:legacyLauncherBannerDismissed', legacyBannerDismissed ? '1' : '0'); } catch { /* quota */ }
  }, [legacyBannerDismissed]);

  // --- Callbacks ---

  const handleSelectGame = useCallback((id: string) => {
    setSelectedGameId(id);
    setShowMobileDetail(true);
    setAudioKey(k => k + 1);
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

  // --- Build compatibility ---

  const filterBuilds = !!launcherPlatform && isLauncherVersionAtLeast('1.3.0');

  const selectedBuildCompatible = !filterBuilds || !selectedBuild
    || (isPlatformCompatible(selectedBuild.platform, launcherPlatform, protonReady) && isArchCompatible(selectedBuild.arch, launcherArch));

  const incompatibleBuildReason = selectedBuild && !selectedBuildCompatible
    ? `This build is for ${selectedBuild.platform ?? 'a different platform'}${selectedBuild.arch ? ` (${selectedBuild.arch})` : ''} and can't run on your system${launcherPlatform ? ` (${launcherPlatform}${launcherArch ? `, ${launcherArch}` : ''})` : ''}.`
    : undefined;

  const noSupportedBuildsNotice = (
    <p className="text-sm w-full" style={{ color: 'var(--theme-text-muted)' }}>
      There are currently no supported builds for your system{launcherPlatform ? ` (${launcherPlatform})` : ''}.
      {launcherPlatform === 'Linux' && !protonReady && (
        <>
          {' '}Try{' '}
          <Link to="/settings#proton" className="underline hover:no-underline">
            enabling Proton support
          </Link>
          {' '}in the launcher settings.
        </>
      )}
    </p>
  );

  // --- Props assembly ---

  const versionPickerProps = useMemo(() => ({
    visibleReleases,
    compatibleAssets,
    platform: launcherPlatform,
    protonReady,
    showIncompatible: filterBuilds ? showIncompatible : undefined,
    setShowIncompatible: filterBuilds ? setShowIncompatible : undefined,
    selectedTag,
    selectedAsset,
    setSelectedTag,
    setSelectedAsset,
    showNightlies,
    setShowNightlies,
    loading: releasesLoading,
    error: releasesError,
    stale: releasesStale,
    updatedAt: releasesUpdatedAt,
  }), [visibleReleases, compatibleAssets, launcherPlatform, protonReady, filterBuilds, showIncompatible, setShowIncompatible, selectedTag, selectedAsset, setSelectedTag, setSelectedAsset, showNightlies, setShowNightlies, releasesLoading, releasesError, releasesStale, releasesUpdatedAt]);

  const actionButtonsProps = selectedGame ? {
    game: selectedGame,
    isInCEF,
    openExternal,
    extracting: installation.extracting,
    extractProgress: installation.extractProgress,
    extractString: installation.extractString,
    isoInstalled: installation.isoInstalled,
    updating: installation.updating,
    downloadProgress: installation.downloadProgress,
    downloadString: installation.downloadString,
    exeUpdated: installation.exeUpdated,
    selectedBuild,
    installedBuilds: installation.installedBuilds,
    canInstall,
    selectionMismatch,
    newerReleaseAvailable,
    newerInstalledBuild,
    noCompatibleBuilds,
    selectedBuildCompatible,
    incompatibleBuildReason,
    isSelectedBuildRunning: runningGameHook.isSelectedBuildRunning(selectedBuild),
    runningBuildForSelectedGame: runningGameHook.runningBuildForSelectedGame,
    noSupportedBuildsNotice,
    onInstallIso: installation.handleInstallIso,
    onTriggerUpdate: triggerUpdate,
    onRequestPlay: runningGameHook.requestPlay,
    onCloseRunningGame: runningGameHook.closeRunningGame,
    onRemoveBuild: removeBuild,
    onRemoveAssets: removeAssets,
    onSwitchToInstalledBuild: switchToInstalledBuild,
    onOpenManage: isLauncherVersionAtLeast('1.4.0') || !selectedGame.disableSaveManager ? () => setShowManageModal(true) : undefined,
    updateInstalled: installation.updateInstalled,
    dlcInstalled: installation.dlcInstalled,
    versionPicker: versionPickerProps,
  } : null;

  const openEditor = useCallback((game: Game | null, creating: boolean, previewing: boolean) => {
    if (creating) {
      navigate('/game-editor');
    } else if (previewing && game) {
      navigate(`/game-editor/${game.recompName}/preview`);
    } else if (game) {
      navigate(`/game-editor/${game.recompName}`);
    }
  }, [navigate]);

  return (
    <div className={`flex h-screen flex-col relative overflow-hidden ${SIDEBAR_WIDTH_CLASS}`}>
      <Sidebar />
      <LibraryBanners
        isLegacyLauncher={isLegacyLauncher}
        legacyBannerDismissed={legacyBannerDismissed}
        onDismissLegacyBanner={() => setLegacyBannerDismissed(true)}
        infoBannerDismissed={infoBannerDismissed}
        onDismissInfoBanner={() => setInfoBannerDismissed(true)}
        isInCEF={isInCEF}
        openExternal={openExternal}
      />
      <div className="relative z-20">
        <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} audioMuted={audioMuted} onToggleMute={() => setAudioMuted(m => !m)} isInCEF={isInCEF} />
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10">
        <GameList
          games={filteredGames}
          selectedGameId={selectedGameId}
          onSelectGame={handleSelectGame}
          onCreateGame={(user?.role === 'admin' || user?.role === 'developer') ? () => openEditor(null, true, false) : undefined}
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
          <div className="flex-1 overflow-y-auto relative" style={{ overscrollBehavior: 'contain' }}>
          {selectedGame ? (
            <>
              <GameDetailHeader
                game={selectedGame}
                slotA={crossfade.slotA}
                slotB={crossfade.slotB}
                activeSlot={crossfade.activeSlot}
                isInCEF={isInCEF}
                openExternal={openExternal}
                canEdit={canEditGame(selectedGame.id)}
                canPreview={user?.role === 'developer' || user?.role === 'admin'}
                onEdit={() => openEditor(selectedGame, false, false)}
                onPreview={() => openEditor(selectedGame, false, true)}
                averageRating={gameRatings[selectedGame.id]?.averageRating || 0}
                totalRatings={gameRatings[selectedGame.id]?.totalRatings || 0}
                userRating={userRatings[selectedGame.id]}
                onRate={user ? (stars) => rateGame(selectedGame.id, stars) : undefined}
                isLoggedIn={!!user}
                isFavorite={isFavorite(selectedGame.id)}
                onToggleFavorite={() => toggleFavorite(selectedGame.id)}
                launchError={runningGameHook.launchError}
                onDismissLaunchError={() => {
                  runningGameHook.setLaunchError(null);
                  const w = window as any;
                  if (typeof w.clearLaunchError === 'function') w.clearLaunchError();
                }}
                actionButtonsProps={actionButtonsProps}
              />

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
                            onClick={() => setEditingDescription(true)}
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
                      <GameMediaCarousel mediaLinks={selectedGame.mediaLinks} />
                    )}
                    {/* Related News */}
                    <GameNewsSection
                      posts={newsPosts.filter(p => p.recompId === selectedGame.id)}
                    />
                  </div>

                  {/* Sidebar */}
                  <GameInfoSidebar
                    game={selectedGame}
                    isInCEF={isInCEF}
                    getCvarValue={getCvarValue}
                    setCvarValue={setCvarValue}
                    resetCvar={resetCvar}
                    playtime={getPlaytime(selectedGame.recompName)}
                  />
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
        <DescriptionEditorModal
          game={selectedGame}
          onSave={async (description) => {
            await saveGame({ ...selectedGame, description });
          }}
          onClose={() => setEditingDescription(false)}
        />
      )}

      <ConfirmCloseGameDialog
        pendingPlayBuild={runningGameHook.pendingPlayBuild}
        runningGame={runningGameHook.runningGame}
        onCancel={() => runningGameHook.setPendingPlayBuild(null)}
        onConfirm={runningGameHook.confirmCloseAndPlay}
      />

      <ConfirmRemoveBuildDialog
        build={pendingRemoveBuild}
        onCancel={() => setPendingRemoveBuild(null)}
        onConfirm={confirmRemoveBuild}
      />

      <ExtractErrorDialog
        error={installation.extractError}
        onClose={installation.clearExtractError}
      />

      {selectedGame && showManageModal && (
        <GameManageModal
          game={selectedGame}
          open={showManageModal}
          onClose={() => { setShowManageModal(false); setManageModalInitialTab(undefined); }}
          canEdit={canEditGame(selectedGame.id)}
          onSaveGame={saveGame}
          initialTab={manageModalInitialTab}
        />
      )}
    </div>
  );
}
