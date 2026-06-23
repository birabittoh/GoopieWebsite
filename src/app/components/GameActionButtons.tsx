import { useNavigate } from 'react-router';
import { Play, FolderOpen, Trash2, Download, RefreshCw, ExternalLink, X, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { GameVersionPicker } from './GameVersionPicker';
import { InstalledBuildsList } from './InstalledBuildsList';
import type { Game } from '../types/game';
import type { InstalledBuild, GameRelease, ReleaseAsset } from '../data/useGameReleases';

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
  onRemoveAssets: () => void;
  onSwitchToInstalledBuild: (build: InstalledBuild) => void;

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
  versionPicker,
}: GameActionButtonsProps) {
  const navigate = useNavigate();

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

  if (!isInCEF) return null;

  return (
    <div className={compact ? '' : 'p-4 rounded-lg shadow bg-[var(--theme-card-bg)] mb-4'} style={compact ? undefined : { backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
      {extracting ? (
        <div className={compact ? 'flex items-center gap-2' : 'w-full max-w-md'}>
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
            {isSelectedBuildRunning ? (
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
            {selectedBuild && (
              <Button className={`bg-[#8b1a1a] hover:bg-[#a52525] text-white ${btnPxSm}`} onClick={() => onRemoveBuild(selectedBuild)}>
                <Trash2 className={`${iconSize} ${iconMr}`} /> Uninstall
              </Button>
            )}
            {!game.disableSaveManager && (
              <Button
                className={`text-white ${btnPxSm}`}
                style={{ backgroundColor: 'var(--theme-accent)' }}
                onClick={() => navigate(`/${game.recompName}/saves`)}
              >
                <Save className={`${iconSize} ${iconMr}`} /> {compact ? 'Saves' : 'Manage Saves'}
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
            {selectedBuild ? (
              <Button className={`bg-[#8b1a1a] hover:bg-[#a52525] text-white ${btnPxSm}`} onClick={() => onRemoveBuild(selectedBuild)}>
                <Trash2 className={`${iconSize} ${iconMr}`} /> Uninstall
              </Button>
            ) : installedBuilds.length === 0 && isoInstalled && (
              <Button className={`bg-[#8b1a1a] hover:bg-[#a52525] text-white ${btnPxSm}`} onClick={onRemoveAssets}>
                <Trash2 className={`${iconSize} ${iconMr}`} /> Remove assets
              </Button>
            )}
          </div>
        )
      ) : (
        <Button
          className={`bg-[#da5d09] hover:bg-[#f18339] text-white ${btnPx}`}
          onClick={onInstallIso}
        >
          <FolderOpen className={`${iconSize} ${iconMr}`} /> Select Game Iso
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
          <InstalledBuildsList builds={installedBuilds} onPlay={onRequestPlay} onClose={onCloseRunningGame} onRemove={onRemoveBuild} runningBuild={runningBuildForSelectedGame} compact={compact} />
        </div>
      )}
    </div>
  );
}
