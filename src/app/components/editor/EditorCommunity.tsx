import type { Game } from '../../types/game';
import { Input } from '../ui/input';
import { EditorSection } from './EditorSection';
import { inputStyle, labelStyle } from './editorStyles';

const SOCIAL_KEYS = ['discord', 'twitter', 'bluesky', 'youtube', 'patreon', 'kofi', 'website', 'github', 'reddit'] as const;

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
}

export function EditorCommunity({ form, update, readOnly }: Props) {
  return (
    <EditorSection title="Community">
      <div>
        <p className="text-xs mb-3" style={{ color: 'var(--theme-text-muted)' }}>Social Links</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOCIAL_KEYS.map(key => (
            <div key={key}>
              <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--theme-text-muted)' }}>{key}</label>
              <Input
                value={form.socialLinks?.[key] || ''}
                onChange={e => {
                  const copy = { ...form.socialLinks };
                  if (e.target.value) { copy[key] = e.target.value; } else { delete copy[key]; }
                  update('socialLinks', copy);
                }}
                placeholder="https://..."
                style={inputStyle}
                disabled={readOnly}
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>
          Discord Guild ID <span className="opacity-60">(for embedded widget — right-click server icon → Copy Server ID)</span>
        </label>
        <Input
          value={form.discordGuildId || ''}
          onChange={e => update('discordGuildId', e.target.value || undefined)}
          placeholder="e.g. 1513356298874388640"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>
    </EditorSection>
  );
}
