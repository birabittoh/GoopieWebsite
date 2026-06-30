import type { Game } from '../../types/game';
import { Input } from '../ui/input';
import { EditorToggle } from './EditorToggle';
import { EditorSection } from './EditorSection';
import { inputStyle, labelClass, labelStyle } from './editorStyles';

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
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
      {form.discordPresenceEnabled === true && !form.iconUrl && (
        <p className="text-xs mt-1" style={{ color: '#d97706' }}>
          No Icon URL set — Discord will show the default Goopie icon. Set an Icon URL in Visuals to use a custom image.
        </p>
      )}
      <EditorToggle
        checked={form.achievementsEnabled === true}
        onChange={v => update('achievementsEnabled', v || undefined)}
        label="Achievements"
        description={form.achievementsEnabled
          ? '— Achievement list shown in the Manage tab'
          : '— Off: achievements tab is hidden'}
        disabled={readOnly}
      />
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
    </EditorSection>
  );
}
