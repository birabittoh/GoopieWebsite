import { useState } from 'react';
import { Check, ChevronDown, Package } from 'lucide-react';
import { Game } from '../types/game';
import { GameRelease, InstalledInfo, ReleaseAsset } from '../data/useGameReleases';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Props {
  game: Game;
  visibleReleases: GameRelease[];
  sortedAssets: ReleaseAsset[];
  selectedTag: string | undefined;
  selectedAsset: string | undefined;
  setSelectedTag: (tag: string | undefined) => void;
  setSelectedAsset: (asset: string | undefined) => void;
  showNightlies: boolean;
  setShowNightlies: (v: boolean) => void;
  installed: InstalledInfo | null;
  loading: boolean;
  error: string | null;
  /** True when `visibleReleases` is being served from a cached fallback after a fetch error. */
  stale?: boolean;
  /** Timestamp (ms) of when the currently-shown release data was fetched. */
  updatedAt?: number;
  /** Use the smaller (mobile) trigger styling. */
  compact?: boolean;
}

function shortBuildLabel(assetName: string, recompName: string): string {
  const lower = assetName.toLowerCase();
  const stripped = lower
    .replace(new RegExp(`^${recompName.toLowerCase()}-?`), '')
    .replace(/\.tar\.gz$/, '')
    .replace(/\.(exe|zip|7z)$/, '');
  const noArch = stripped.replace(/^windows-x64-?/, '');
  return noArch.length > 0 ? noArch : 'default';
}

export function GameVersionPicker({
  game,
  visibleReleases,
  sortedAssets,
  selectedTag,
  selectedAsset,
  setSelectedTag,
  setSelectedAsset,
  showNightlies,
  setShowNightlies,
  installed,
  loading,
  error,
  stale,
  updatedAt,
  compact,
}: Props) {
  const [open, setOpen] = useState(false);

  const installedTagMatches = !!installed?.version && installed.version === selectedTag;
  const installedAssetMatches = !!installed?.asset && installed.asset === selectedAsset;
  const upToDate = installedTagMatches && installedAssetMatches;

  const installedLabel = installed?.version
    ? `${installed.version}${installed.asset ? ` · ${shortBuildLabel(installed.asset, game.recompName)}` : ''}`
    : 'Not installed';

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--theme-card-bg)',
    color: 'var(--theme-text-primary)',
    borderColor: 'var(--theme-border)',
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-md border px-3 ${compact ? 'h-8 text-xs' : 'h-9 text-sm'} hover:opacity-90 transition-opacity`}
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
          title="Change version / build"
        >
          <Package className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
          <span style={{ color: 'var(--theme-text-secondary)' }}>Version:</span>
          <span className="font-semibold">{installedLabel}</span>
          {upToDate && <Check className="w-3.5 h-3.5 text-green-400" aria-label="Matches selection" />}
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3 space-y-3"
        style={{
          backgroundColor: 'var(--theme-card-bg)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm">Version & Build</span>
          <label className="flex items-center gap-1 cursor-pointer select-none text-xs">
            <input
              type="checkbox"
              checked={showNightlies}
              onChange={e => setShowNightlies(e.target.checked)}
              style={{ accentColor: 'var(--theme-accent)' }}
            />
            <span style={{ color: 'var(--theme-text-secondary)' }}>Show nightlies</span>
          </label>
        </div>

        <div className="text-xs space-y-0.5" style={{ color: 'var(--theme-text-muted)' }}>
          <div className="flex items-center gap-1">
            <span>Installed:</span>
            <span style={{ color: 'var(--theme-text-primary)' }}>{installedLabel}</span>
            {upToDate && <Check className="w-3 h-3 text-green-400" />}
          </div>
          <div>
            Selected:&nbsp;
            <span style={{ color: 'var(--theme-text-primary)' }}>
              {selectedTag ?? '—'}
              {selectedAsset ? ` · ${shortBuildLabel(selectedAsset, game.recompName)}` : ''}
            </span>
          </div>
        </div>

        {loading && (
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Loading releases…</div>
        )}
        {error && !loading && (
          <div className="text-xs text-red-400">Failed to load releases: {error}</div>
        )}
        {stale && !loading && (
          <div className="text-xs text-amber-400">
            Showing cached data from {updatedAt ? new Date(updatedAt).toLocaleString() : 'earlier'} — GitHub may be rate-limiting requests.
          </div>
        )}

        {!loading && !error && visibleReleases.length === 0 && (
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            No releases available{showNightlies ? '' : ' (try enabling nightlies)'}.
          </div>
        )}

        {visibleReleases.length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1">
              <span style={{ color: 'var(--theme-text-secondary)' }}>Version</span>
              <Select value={selectedTag ?? ''} onValueChange={v => setSelectedTag(v || undefined)}>
                <SelectTrigger size="sm" className="rounded border text-xs" style={selectStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={selectStyle}>
                  {visibleReleases.map(r => (
                    <SelectItem key={r.tag} value={r.tag}>
                      {r.tag}{r.prerelease ? ' (nightly)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ color: 'var(--theme-text-secondary)' }}>Build</span>
              <Select
                value={selectedAsset ?? ''}
                onValueChange={v => setSelectedAsset(v || undefined)}
                disabled={sortedAssets.length === 0}
              >
                <SelectTrigger size="sm" className="rounded border text-xs" style={selectStyle}>
                  <SelectValue placeholder="No builds" />
                </SelectTrigger>
                <SelectContent style={selectStyle}>
                  {sortedAssets.map(a => (
                    <SelectItem key={a.name} value={a.name}>
                      {shortBuildLabel(a.name, game.recompName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
