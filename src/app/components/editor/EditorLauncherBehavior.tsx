import { Plus, X } from 'lucide-react';
import type { Game } from '../../types/game';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditorToggle } from './EditorToggle';
import { EditorSection } from './EditorSection';
import { inputStyle, labelClass, labelStyle } from './editorStyles';

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
}

function ColumnNamesEditor({ form, update, readOnly, viewId }: Props & { viewId: string }) {
  const allColumnNames = form.leaderboardColumnNames || {};
  const entries = Object.entries(allColumnNames[viewId] || {});

  const setEntries = (next: [string, string][]) => {
    const map: Record<string, string> = {};
    for (const [id, name] of next) map[id] = name;
    const nextAll = { ...allColumnNames };
    if (Object.keys(map).length > 0) nextAll[viewId] = map; else delete nextAll[viewId];
    update('leaderboardColumnNames', Object.keys(nextAll).length > 0 ? nextAll : undefined);
  };

  const updateEntry = (i: number, patch: Partial<{ id: string; name: string }>) => {
    const next = entries.map(([id, name], j) => (j === i ? [patch.id ?? id, patch.name ?? name] as [string, string] : [id, name] as [string, string]));
    setEntries(next);
  };

  return (
    <div className="ml-6 mt-2 space-y-2">
      {entries.map(([id, name], i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            type="number"
            value={id}
            onChange={e => updateEntry(i, { id: e.target.value })}
            placeholder="Column ID"
            className="w-24"
            style={inputStyle}
            disabled={readOnly}
          />
          <Input
            value={name}
            onChange={e => updateEntry(i, { name: e.target.value })}
            placeholder="Score"
            style={inputStyle}
            disabled={readOnly}
          />
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              onClick={() => setEntries(entries.filter((_, j) => j !== i))}
              className="bg-red-600 hover:bg-red-700 text-white"
              title="Remove column mapping"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button
          type="button"
          size="sm"
          className="text-white"
          style={{ backgroundColor: 'var(--theme-item-selected)' }}
          onClick={() => setEntries([...entries, ['', '']])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Column Name
        </Button>
      )}
    </div>
  );
}

function LeaderboardViewNamesEditor({ form, update, readOnly }: Props) {
  const entries = Object.entries(form.leaderboardViewNames || {});

  const setEntries = (next: [string, string][]) => {
    const map: Record<string, string> = {};
    for (const [id, name] of next) map[id] = name;
    update('leaderboardViewNames', Object.keys(map).length > 0 ? map : undefined);
  };

  const updateEntry = (i: number, patch: Partial<{ id: string; name: string }>) => {
    const prevId = entries[i][0];
    const next = entries.map(([id, name], j) => (j === i ? [patch.id ?? id, patch.name ?? name] as [string, string] : [id, name] as [string, string]));
    setEntries(next);
    if (patch.id !== undefined && patch.id !== prevId) {
      const allColumnNames = form.leaderboardColumnNames || {};
      if (allColumnNames[prevId]) {
        const nextAll = { ...allColumnNames, [patch.id]: allColumnNames[prevId] };
        delete nextAll[prevId];
        update('leaderboardColumnNames', Object.keys(nextAll).length > 0 ? nextAll : undefined);
      }
      const allAscending = form.leaderboardViewAscending || {};
      if (prevId in allAscending) {
        const nextAll = { ...allAscending, [patch.id]: allAscending[prevId] };
        delete nextAll[prevId];
        update('leaderboardViewAscending', Object.keys(nextAll).length > 0 ? nextAll : undefined);
      }
    }
  };

  const setAscending = (viewId: string, ascending: boolean) => {
    const allAscending = { ...(form.leaderboardViewAscending || {}) };
    if (ascending) allAscending[viewId] = true; else delete allAscending[viewId];
    update('leaderboardViewAscending', Object.keys(allAscending).length > 0 ? allAscending : undefined);
  };

  return (
    <div className="rounded-md border p-3 mt-2" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-page-bg)' }}>
      <p className="text-xs mb-2" style={{ color: 'var(--theme-text-muted)' }}>
        Maps each leaderboard's numeric View ID (visible in the Leaderboards tab and the game's leaderboard TOML files) to a
        human-readable name, and each view's numeric column IDs to their own names. Anything left unmapped falls back to
        "View &lt;id&gt;" / "Column &lt;id&gt;".
      </p>
      <div className="space-y-3">
        {entries.map(([id, name], i) => (
          <div key={i} className="rounded-md border p-2" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={id}
                onChange={e => updateEntry(i, { id: e.target.value })}
                placeholder="View ID"
                className="w-24"
                style={inputStyle}
                disabled={readOnly}
              />
              <Input
                value={name}
                onChange={e => updateEntry(i, { name: e.target.value })}
                placeholder="Best Lap Time"
                style={inputStyle}
                disabled={readOnly}
              />
              <Select
                value={form.leaderboardViewAscending?.[id] ? 'asc' : 'desc'}
                onValueChange={v => setAscending(id, v === 'asc')}
                disabled={readOnly || id === ''}
              >
                <SelectTrigger className="w-40 rounded-md text-sm border shrink-0" style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={inputStyle}>
                  <SelectItem value="desc">Highest first (score)</SelectItem>
                  <SelectItem value="asc">Lowest first (time)</SelectItem>
                </SelectContent>
              </Select>
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEntries(entries.filter((_, j) => j !== i))}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  title="Remove mapping"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {id !== '' && <ColumnNamesEditor form={form} update={update} readOnly={readOnly} viewId={id} />}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          type="button"
          size="sm"
          className="text-white mt-2"
          style={{ backgroundColor: 'var(--theme-item-selected)' }}
          onClick={() => setEntries([...entries, ['', '']])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add View Name
        </Button>
      )}
    </div>
  );
}

export function EditorLauncherBehavior({ form, update, readOnly }: Props) {
  return (
    <EditorSection title="Launcher Behavior">
      <EditorToggle
        checked={form.disableSaveManager === true}
        onChange={v => update('disableSaveManager', v || undefined)}
        label="Disable Save Manager"
        description={form.disableSaveManager ? '— Save manager is hidden for this game' : '— Save manager is available'}
        activeColor="#dc2626"
        disabled={readOnly}
      />
      <EditorToggle
        checked={form.setGameDataRootToAssets === true}
        onChange={v => update('setGameDataRootToAssets', v || undefined)}
        label="Set game_data_root to assets folder"
        description={form.setGameDataRootToAssets ? '— Adds --game_data_root=".../assets" when launching' : '— Do not pass --game_data_root'}
        disabled={readOnly}
      />
      <EditorToggle
        checked={form.isXBLA === true}
        onChange={v => update('isXBLA', v || undefined)}
        label="XBLA"
        description={form.isXBLA ? '— No file filter on extract; launches with --license_mask=1' : '— Extract filters for .iso files'}
        disabled={readOnly}
      />
      <EditorToggle
        checked={form.useXenosRenderer === true}
        onChange={v => update('useXenosRenderer', v || undefined)}
        label="Xenos Renderer"
        description={form.useXenosRenderer
          ? '— Launches with --gpu_plugin xenos'
          : '— Uses the default GPU plugin'}
        disabled={readOnly}
      />
      <EditorToggle
        checked={form.noAssetExtraction === true}
        onChange={v => update('noAssetExtraction', v || undefined)}
        label="No Asset Extraction"
        description={form.noAssetExtraction ? '— Skips ISO/STFS extraction; build download only' : '— Requires user to provide game files'}
        disabled={readOnly}
      />
      <EditorToggle
        checked={form.discordPresenceEnabled === true}
        onChange={v => update('discordPresenceEnabled', v || undefined)}
        label="Discord Rich Presence"
        description={form.discordPresenceEnabled
          ? '— Launcher shows "Playing <title>" on Discord while this game runs'
          : '— Off: the game handles its own Discord presence'}
        disabled={readOnly}
      />
      {form.discordPresenceEnabled === true && !form.discordIconUrl && (
        <p className="text-xs mt-1" style={{ color: '#d97706' }}>
          No Discord Rich Presence Icon URL set. Discord will show the default Goopie icon.{' '}
          <button type="button" className="underline hover:opacity-70 text-xs" onClick={() => {
            const el = document.getElementById('visuals');
            const container = el?.closest('.overflow-y-auto');
            if (el && container) {
              container.scrollTo({ top: el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop, behavior: 'smooth' });
            }
          }}>Set one in Visuals</button> to use a custom image.
        </p>
      )}
      <EditorToggle
        checked={form.modsEnabled === true}
        onChange={v => update('modsEnabled', v || undefined)}
        label="Mods"
        description={form.modsEnabled
          ? '— Mods button shown in the game page'
          : '— Off: mods button is hidden'}
        disabled={readOnly}
      />
      <EditorToggle
        checked={form.achievementsEnabled === true}
        onChange={v => update('achievementsEnabled', v || undefined)}
        label="Achievements"
        description={form.achievementsEnabled
          ? '— Achievement list shown in the Manage tab'
          : '— Off: achievements tab is hidden'}
        disabled={readOnly}
      />
      <EditorToggle
        checked={form.leaderboardsEnabled === true}
        onChange={v => update('leaderboardsEnabled', v || undefined)}
        label="Leaderboards"
        description={form.leaderboardsEnabled
          ? '— Leaderboards tab shown in the Manage modal'
          : '— Off: leaderboards tab is hidden'}
        disabled={readOnly}
      />
      {form.leaderboardsEnabled === true && (
        <LeaderboardViewNamesEditor form={form} update={update} readOnly={readOnly} />
      )}
      <div>
        <label className={labelClass} style={labelStyle}>External Launcher URL (optional)</label>
        <Input
          value={form.externalLauncherUrl || ''}
          onChange={e => update('externalLauncherUrl', e.target.value || undefined)}
          placeholder="https://..."
          style={inputStyle}
          disabled={readOnly}
        />
        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          For games with a proprietary launcher — shows a download/link button instead of the built-in launcher.
        </p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Title ID (optional)</label>
        <Input
          value={form.titleId || ''}
          onChange={e => update('titleId', e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 8).toLowerCase() || undefined)}
          placeholder="58410847"
          className="w-40"
          style={inputStyle}
          disabled={readOnly}
        />
        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          The game's 8-hex-digit Xbox 360 title id. A user could copy a store file (e.g. a leaderboard file) under a
          slightly different name, which would otherwise be mistaken for the real one — set this so the launcher can
          always tell them apart.
        </p>
      </div>
    </EditorSection>
  );
}
