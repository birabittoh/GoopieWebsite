import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Play, FolderOpen, Trash2, Download, RefreshCw, ExternalLink, X, Settings2, RotateCcw, Package } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ConfirmDialog } from './ConfirmDialog';
import { GameVersionPicker } from './GameVersionPicker';
import { InstalledBuildsList } from './InstalledBuildsList';
import type { Game } from '../types/game';
import type { InstalledBuild, GameRelease, ReleaseAsset } from '../data/useGameReleases';
import { updateRequiredForBuild } from '../utils/updateRequired';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

/** Strip the game's recompName prefix off an asset/build filename so it reads
 *  as a short, human-friendly descriptor (e.g. "windows-x64-release.exe"). */
function describeAsset(recompName: string, assetOrName: string): string {
  const stripped = assetOrName.replace(
    new RegExp(`^${recompName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-?`),
    '',
  );
  return stripped || assetOrName;
}

export interface GameActionButtonsProps {
  game: Game;
  isInCEF: boolean;
  openExternal: (url: string) => void;
  compact?: boolean;

  // Install / extraction state
  extracting: boolean;
  extractProgress: number;
  extractString: string;
  isoInstalled: boolean;
  updating: boolean;
  downloadProgress: number;
  downloadString: string;
  exeUpdated: boolean;

  // Build state
  selectedBuild: InstalledBuild | null | undefined;
  installedBuilds: InstalledBuild[];
  canInstall: boolean;
  selectionMismatch: boolean;
  newerReleaseAvailable: boolean;
  newerInstalledBuild: InstalledBuild | null;
  noCompatibleBuilds: boolean;
  selectedBuildCompatible: boolean;
  incompatibleBuildReason: string | undefined;
  isSelectedBuildRunning: boolean;
  runningBuildForSelectedGame: string | null;
  noSupportedBuildsNotice: React.ReactNode;

  // Actions
  onInstallIso: () => void;
  onTriggerUpdate: () => void;
  onRequestPlay: (build: InstalledBuild) => void;
  onCloseRunningGame: () => void;
  onRemoveBuild: (build: InstalledBuild) => void;
  /** Pass `force: true` to also remove the installed title update and DLC first. */
  onRemoveAssets: (force?: boolean) => void;
  onSwitchToInstalledBuild: (build: InstalledBuild) => void;
  onOpenManage?: () => void;
  onOpenMods?: () => void;
  updateInstalled?: boolean;
  dlcInstalled?: boolean;

  // Version picker props
  versionPicker: {
    visibleReleases: GameRelease[];
    compatibleAssets: ReleaseAsset[];
    platform: string | null | undefined;
    protonReady: boolean;
    showIncompatible: boolean | undefined;
    setShowIncompatible: ((v: boolean) => void) | undefined;
    selectedTag: string | undefined;
    selectedAsset: string | undefined;
    setSelectedTag: (tag: string | undefined) => void;
    setSelectedAsset: (asset: string | undefined) => void;
    showNightlies: boolean;
    setShowNightlies: (v: boolean) => void;
    loading: boolean;
    error: string | null | undefined;
    stale: boolean;
    updatedAt: number | null | undefined;
  };
}

export function GameActionButtons({
  game,
  isInCEF,
  openExternal,
  compact,
  extracting,
  extractProgress,
  extractString,
  isoInstalled,
  updating,
  downloadProgress,
  downloadString,
  exeUpdated,
  selectedBuild,
  installedBuilds,
  canInstall,
  selectionMismatch,
  newerReleaseAvailable,
  newerInstalledBuild,
  noCompatibleBuilds,
  selectedBuildCompatible,
  incompatibleBuildReason,
  isSelectedBuildRunning,
  runningBuildForSelectedGame,
  noSupportedBuildsNotice,
  onInstallIso,
  onTriggerUpdate,
  onRequestPlay,
  onCloseRunningGame,
  onRemoveBuild,
  onRemoveAssets,
  onSwitchToInstalledBuild,
  onOpenManage,
  onOpenMods,
  updateInstalled,
  dlcInstalled,
  versionPicker,
}: GameActionButtonsProps) {
  // Visible only once a build is actually selected *and* installed (present in
  // installedBuilds) — before that there's nothing to browse mods against yet.
  const showModsButton =
    !!onOpenMods &&
    isLauncherVersionAtLeast('1.7.0') &&
    !!game.modsEnabled &&
    isoInstalled &&
    !!selectedBuild &&
    installedBuilds.some(b => b.name === selectedBuild.name);
  const [showTuDialog, setShowTuDialog] = useState(false);

  // Only relevant when the TU is optional — if it's required, no build (installed
  // or not) will ever be able to skip it, so there's nothing to fall back to.
  //
  // Deliberately not limited to already-installed builds: the whole point of this
  // fallback is to get a user who's stuck on a TU-requiring build unstuck even if
  // they've never downloaded another asset for this game. Picking an uninstalled
  // asset just switches the version-picker selection to it — the action button
  // then reads "Install"/"Update" instead of "Play", same as any other uninstalled
  // selection.
  const noTuFallbackBuild = useMemo(() => {
    if (game.updateStatus !== 'optional' || !selectedBuild) return null;
    const withoutTu = (asset: string | undefined, name: string) =>
      (asset || name) !== (selectedBuild.asset || selectedBuild.name) &&
      !updateRequiredForBuild(game, asset || name);

    // Prefer another installed build of the very same version (different asset/platform).
    const installedSameVersion = installedBuilds.find(
      b => b.version === selectedBuild.version && withoutTu(b.asset, b.name)
    );
    if (installedSameVersion) return installedSameVersion;

    // Otherwise, any other compatible asset from the currently selected release
    // that doesn't require the TU, installed or not.
    if (selectedBuild.version === versionPicker.selectedTag) {
      const availableAsset = versionPicker.compatibleAssets.find(a => withoutTu(a.name, a.name));
      if (availableAsset) {
        return { name: availableAsset.name, version: versionPicker.selectedTag, asset: availableAsset.name };
      }
    }

    // Only once every asset of the current version requires the TU do we look
    // through other installed versions for the closest one that doesn't need it.
    const currentIndex = installedBuilds.findIndex(b => b.name === selectedBuild.name);
    const older = currentIndex >= 0 ? installedBuilds.slice(currentIndex + 1) : [];
    return older.find(b => b.version !== selectedBuild.version && withoutTu(b.asset, b.name)) ?? null;
  }, [game, installedBuilds, selectedBuild, versionPicker.selectedTag, versionPicker.compatibleAssets]);

  // What to call the fallback build in the dialog/button. When it's a
  // different version, the version number alone is unambiguous ("v1.3.0").
  // When it's the *same* version (just a different asset), showing the
  // version would misleadingly suggest it's the same build — describe the
  // asset instead so it's clear it's a different download.
  const noTuFallbackLabel = useMemo(() => {
    if (!noTuFallbackBuild) return null;
    if (!selectedBuild || noTuFallbackBuild.version !== selectedBuild.version) {
      return noTuFallbackBuild.version || noTuFallbackBuild.name;
    }
    return describeAsset(game.recompName, noTuFallbackBuild.asset || noTuFallbackBuild.name);
  }, [noTuFallbackBuild, selectedBuild, game.recompName]);

  const [showRemoveAssetsDialog, setShowRemoveAssetsDialog] = useState(false);
  const btnPx = compact ? 'px-4 py-2 text-sm' : 'px-4 py-3 md:px-8 md:py-6 text-sm md:text-lg';
  const btnPxSm = compact ? 'px-4 py-2 text-sm' : 'px-4 py-3 md:px-6 md:py-6 text-sm md:text-lg';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const iconMr = compact ? 'mr-1' : 'mr-2';

  if (game.externalLauncherUrl) {
    return (
      <div className={compact ? '' : 'p-4 rounded-lg shadow bg-[var(--theme-card-bg)]'} style={compact ? undefined : { backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
        <a
          href={game.externalLauncherUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(game.externalLauncherUrl!); } }}
        >
          <Button className={`text-white ${btnPx}`} style={{ backgroundColor: 'var(--theme-accent)' }}>
            <ExternalLink className={`${iconSize} ${iconMr}`} />
            Get Game
          </Button>
        </a>
      </div>
    );
  }

  if (!isInCEF) {
    return (
      <div className={compact ? '' : 'p-4 rounded-lg shadow bg-[var(--theme-card-bg)]'} style={compact ? undefined : { backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
        <Link to="/downloads">
          <Button className={`bg-[#5c7e10] hover:bg-[#78a00f] text-white ${btnPx}`}>
            <Download className={`${iconSize} ${iconMr}`} /> Download Launcher
          </Button>
        </Link>
      </div>
    );
  }

  return (<>
    <div className={compact ? '' : 'p-4 rounded-lg shadow bg-[var(--theme-card-bg)] mb-4'} style={compact ? undefined : { backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
      {extracting ? (
        <div className="flex items-center gap-2">
          <RefreshCw className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} style={{ color: 'var(--theme-accent)' }} />
          <span className={`font-semibold ${compact ? 'text-sm' : ''}`} style={{ color: 'var(--theme-text-primary)' }}>Extracting...</span>
        </div>
      ) : isoInstalled ? (
        updating ? (
          <div className={compact ? '' : 'w-full max-w-md'}>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} style={{ color: 'var(--theme-accent)' }} />
              <span className={`font-semibold ${compact ? 'text-sm' : ''}`} style={{ color: 'var(--theme-text-primary)' }}>Updating...</span>
            </div>
            <Progress value={downloadProgress} className={compact ? 'h-2 mb-1' : 'h-3 mb-2'} style={{ backgroundColor: 'var(--theme-page-bg)' }} />
            <p className={compact ? 'text-xs' : 'text-sm'} style={{ color: 'var(--theme-text-muted)' }}>{downloadString}</p>
          </div>
        ) : exeUpdated ? (
          <div className={`flex flex-wrap gap-${compact ? '2' : '3'}`}>
            {updateRequiredForBuild(game, selectedBuild?.asset || selectedBuild?.name) && !updateInstalled ? (
              <Button
                className={`bg-[#5c7e10] hover:bg-[#78a00f] text-white ${btnPx}`}
                onClick={() => setShowTuDialog(true)}
              >
                <Play className={`${iconSize} ${iconMr}`} /> Play
              </Button>
            ) : isSelectedBuildRunning ? (
              <Button className={`bg-[#8b1a1a] hover:bg-[#a52525] text-white ${btnPx}`} onClick={onCloseRunningGame}>
                <X className={`${iconSize} ${iconMr}`} /> Close
              </Button>
            ) : (
              <Button
                className={`bg-[#5c7e10] hover:bg-[#78a00f] text-white ${btnPx} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#5c7e10]`}
                onClick={() => selectedBuild && onRequestPlay(selectedBuild)}
                disabled={!selectedBuildCompatible}
                title={incompatibleBuildReason}
              >
                <Play className={`${iconSize} ${iconMr}`} /> Play
              </Button>
            )}
            {incompatibleBuildReason && (
              <p className={`${compact ? 'text-xs' : 'text-sm'} w-full`} style={{ color: 'var(--theme-text-muted)' }}>
                {incompatibleBuildReason}
              </p>
            )}
            {canInstall && (selectionMismatch || newerReleaseAvailable) && (
              <Button className={`bg-[#1a6bc4] hover:bg-[#2080e0] text-white ${btnPxSm}`} onClick={onTriggerUpdate}>
                <Download className={`${iconSize} ${iconMr}`} /> {selectedBuild ? 'Update' : 'Install'}
              </Button>
            )}
            {newerInstalledBuild && (
              <Button
                className={`text-white ${btnPxSm}`}
                style={{ backgroundColor: 'var(--theme-accent)' }}
                onClick={() => onSwitchToInstalledBuild(newerInstalledBuild)}
              >
                <RefreshCw className={`${iconSize} ${iconMr}`} /> Switch to {newerInstalledBuild.version || newerInstalledBuild.name}
              </Button>
            )}
            {onOpenManage && (
              <Button
                className={`text-white ${btnPxSm}`}
                style={{ backgroundColor: 'var(--theme-accent)' }}
                onClick={onOpenManage}
              >
                <Settings2 className={`${iconSize} ${iconMr}`} /> Manage
              </Button>
            )}
            {showModsButton && (
              <Button
                className={`text-white ${btnPxSm}`}
                style={{ backgroundColor: 'var(--theme-accent)' }}
                onClick={onOpenMods}
              >
                <Package className={`${iconSize} ${iconMr}`} /> Mods
              </Button>
            )}
          </div>
        ) : (
          <div className={`flex flex-wrap gap-${compact ? '2' : '3'}`}>
            {!canInstall ? null : (noCompatibleBuilds && !selectedBuild) ? (
              noSupportedBuildsNotice
            ) : (
              <Button className={`bg-[#1a6bc4] hover:bg-[#2080e0] text-white ${btnPx}`} onClick={onTriggerUpdate}>
                <Download className={`${iconSize} ${iconMr}`} /> {selectedBuild ? 'Update' : 'Install'}
              </Button>
            )}
            {installedBuilds.length === 0 && isoInstalled && (
              <Button
                className={`bg-[#8b1a1a] hover:bg-[#a52525] text-white ${btnPxSm}`}
                onClick={() => {
                  if (updateInstalled || dlcInstalled) {
                    setShowRemoveAssetsDialog(true);
                  } else {
                    onRemoveAssets();
                  }
                }}
              >
                <Trash2 className={`${iconSize} ${iconMr}`} /> Remove assets
              </Button>
            )}
            {onOpenManage && (
              <Button
                className={`text-white ${btnPxSm}`}
                style={{ backgroundColor: 'var(--theme-accent)' }}
                onClick={onOpenManage}
              >
                <Settings2 className={`${iconSize} ${iconMr}`} /> Manage
              </Button>
            )}
          </div>
        )
      ) : (
        <Button
          className={`bg-[#da5d09] hover:bg-[#f18339] text-white ${btnPx}`}
          onClick={onInstallIso}
        >
          <FolderOpen className={`${iconSize} ${iconMr}`} /> Select Game
        </Button>
      )}
      {isoInstalled && !extracting && !updating && (
        <div className="mt-3">
          <GameVersionPicker
            compact={compact}
            game={game}
            visibleReleases={versionPicker.visibleReleases}
            compatibleAssets={versionPicker.compatibleAssets}
            noCompatibleBuilds={noCompatibleBuilds}
            platform={versionPicker.platform ?? undefined}
            protonReady={compact ? undefined : versionPicker.protonReady}
            showIncompatible={versionPicker.showIncompatible}
            setShowIncompatible={versionPicker.setShowIncompatible}
            selectedTag={versionPicker.selectedTag}
            selectedAsset={versionPicker.selectedAsset}
            setSelectedTag={versionPicker.setSelectedTag}
            setSelectedAsset={versionPicker.setSelectedAsset}
            showNightlies={versionPicker.showNightlies}
            setShowNightlies={versionPicker.setShowNightlies}
            installed={selectedBuild ?? null}
            loading={versionPicker.loading}
            error={versionPicker.error ?? null}
            stale={versionPicker.stale}
            updatedAt={versionPicker.updatedAt ?? undefined}
          />
          <InstalledBuildsList builds={installedBuilds} recompName={game.recompName} onPlay={onRequestPlay} onClose={onCloseRunningGame} onRemove={onRemoveBuild} runningBuild={runningBuildForSelectedGame} compact={compact} />
        </div>
      )}
    </div>
    <ConfirmDialog
      open={showTuDialog}
      title=""
      description={<>This build requires the title update to be installed. You can install it from the Manage panel.{noTuFallbackBuild && <><br />Or use {noTuFallbackLabel}, which doesn't need it.</>}</>}
      confirmLabel="Install it"
      confirmClassName="gap-2 bg-[#1a6bc4] hover:bg-[#2080e0] text-white border-0"
      onConfirm={() => { setShowTuDialog(false); onOpenManage?.(); }}
      onCancel={() => setShowTuDialog(false)}
      extraLabel={noTuFallbackBuild ? `Use ${noTuFallbackLabel}` : undefined}
      extraIcon={<RotateCcw className="w-4 h-4" />}
      onExtra={noTuFallbackBuild ? () => { setShowTuDialog(false); onSwitchToInstalledBuild(noTuFallbackBuild); } : undefined}
    />
    <ConfirmDialog
      open={showRemoveAssetsDialog}
      title="Remove assets?"
      description={
        <>
          This game has {updateInstalled && dlcInstalled ? 'a title update and DLC' : updateInstalled ? 'a title update' : 'DLC'} installed,
          which won't work without the assets. Do you also want to remove{' '}
          {updateInstalled && dlcInstalled ? 'the title update and DLC' : updateInstalled ? 'the title update' : 'the DLC'}?
        </>
      }
      confirmLabel="Delete"
      confirmIcon={<Trash2 className="w-4 h-4" />}
      confirmClassName="gap-2 bg-[#8b1a1a] hover:bg-[#a52525] text-white border-0"
      onConfirm={() => { setShowRemoveAssetsDialog(false); onRemoveAssets(true); }}
      onCancel={() => setShowRemoveAssetsDialog(false)}
    />
  </>
  );
}
