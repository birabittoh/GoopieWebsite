import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { Game } from '../../types/game';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditorSection } from './EditorSection';
import { inputStyle, labelClass, labelStyle } from './editorStyles';

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
}

export function EditorVisuals({ form, update, readOnly }: Props) {
  const [headerImageInput, setHeaderImageInput] = useState('');
  const headerImages: string[] = Array.isArray(form.headerImage) ? form.headerImage : (form.headerImage ? [form.headerImage] : []);

  const addHeader = () => {
    if (!headerImageInput.trim()) return;
    update('headerImage', [...headerImages, headerImageInput.trim()]);
    setHeaderImageInput('');
  };

  return (
    <EditorSection title="Visuals" id="visuals">
      <div>
        <label className={labelClass} style={labelStyle}>Cover Image URL *</label>
        <Input
          value={form.coverImage}
          onChange={e => update('coverImage', e.target.value)}
          placeholder="https://..."
          style={inputStyle}
          required
          disabled={readOnly}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Header Images (cycle every 7s) *</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {headerImages.map((url, i) => (
            <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
              {url.length > 50 ? url.slice(0, 50) + '…' : url}
              {!readOnly && (
                <button type="button" onClick={() => update('headerImage', headerImages.filter((_, j) => j !== i))} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Input
              value={headerImageInput}
              onChange={e => setHeaderImageInput(e.target.value)}
              placeholder="Add header image URL"
              className="flex-1"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHeader(); } }}
            />
            <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }} onClick={addHeader}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
        {headerImages.length === 0 && <p className="text-red-500 text-xs mt-1">At least one header image is required.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Title Image URL (optional)</label>
          <Input
            value={form.titleImage || ''}
            onChange={e => update('titleImage', e.target.value || undefined)}
            placeholder="https://..."
            style={inputStyle}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Title Size Multiplier (optional)</label>
          <Input
            type="number"
            value={form.titleSizeMultiplier || ''}
            onChange={e => update('titleSizeMultiplier', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="e.g. 1.5"
            style={inputStyle}
            disabled={readOnly}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Shortcut Icon URL (optional)</label>
        <Input
          value={form.iconUrl || ''}
          onChange={e => update('iconUrl', e.target.value || undefined)}
          placeholder="https://..."
          style={inputStyle}
          disabled={readOnly}
        />
        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          Used for desktop shortcut icons. Falls back to the icon extracted from the game's XEX when unset.
        </p>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Discord Rich Presence Icon URL (optional)</label>
        <Input
          value={form.discordIconUrl || ''}
          onChange={e => update('discordIconUrl', e.target.value || undefined)}
          placeholder="https://..."
          style={inputStyle}
          disabled={readOnly}
        />
        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          Square image shown in Discord Rich Presence while the game runs. Falls back to the default Goopie icon when unset.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="hideTitleText"
          checked={!!form.hideTitleText}
          onChange={e => update('hideTitleText', e.target.checked || undefined)}
          disabled={readOnly}
          className="w-4 h-4 cursor-pointer"
        />
        <label htmlFor="hideTitleText" className="text-sm cursor-pointer" style={{ color: 'var(--theme-text-secondary)' }}>
          Hide title text (use when title image already shows the game name)
        </label>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Accent Color (PS3 theme background)</label>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="color"
            value={form.accentColor || '#000000'}
            onChange={e => update('accentColor', e.target.value)}
            disabled={readOnly}
            className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
          />
          <Input
            value={form.accentColor || '#000000'}
            onChange={e => update('accentColor', e.target.value)}
            placeholder="#000000"
            style={inputStyle}
            className="w-36"
            disabled={readOnly}
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => update('accentColor', '#000000')}
              className="text-xs px-3 py-1.5 rounded"
              style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-muted)' }}
            >
              Reset
            </button>
          )}
          <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>#000000 = use theme default</span>
        </div>
      </div>
    </EditorSection>
  );
}
