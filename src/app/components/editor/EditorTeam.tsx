import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { Game, Platform } from '../../types/game';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditorSection } from './EditorSection';
import { inputStyle, labelClass, labelStyle } from './editorStyles';

const ALL_PLATFORMS: Platform[] = ['Windows', 'Linux', 'Mac'];

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
}

export function EditorTeam({ form, update, readOnly }: Props) {
  const [devInput, setDevInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const addDev = () => {
    if (!devInput.trim()) return;
    update('recompiled_developers', [...form.recompiled_developers, devInput.trim()]);
    setDevInput('');
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    update('Tags', [...form.Tags, tagInput.trim()]);
    setTagInput('');
  };

  return (
    <EditorSection title="Team & Categorization">
      <div>
        <label className={labelClass} style={labelStyle}>Platforms</label>
        <div className="flex gap-4">
          {ALL_PLATFORMS.map(p => (
            <label key={p} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.platforms?.includes(p) ?? false}
                disabled={readOnly}
                onChange={e => {
                  const current = form.platforms || [];
                  update('platforms', e.target.checked ? [...current, p] : current.filter(x => x !== p));
                }}
                className="accent-[var(--theme-accent)]"
              />
              <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>{p}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Recompiled Developers</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {form.recompiled_developers.map((dev, i) => (
            <span
              key={i}
              className="text-white px-3 py-1 rounded-full text-xs flex items-center gap-1"
              style={{ backgroundColor: 'var(--theme-item-selected)' }}
            >
              {dev}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => update('recompiled_developers', form.recompiled_developers.filter((_, j) => j !== i))}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Input
              value={devInput}
              onChange={e => setDevInput(e.target.value)}
              placeholder="Add developer"
              className="flex-1"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDev(); } }}
            />
            <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }} onClick={addDev}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {form.Tags.map((tag, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded text-xs flex items-center gap-1 relative overflow-hidden"
              style={{ backgroundColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', border: '1px solid var(--theme-border)' }}
            >
              <span
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.18, background: 'repeating-linear-gradient(135deg, var(--theme-accent) 0 8px, transparent 8px 16px)' }}
              />
              <span style={{ position: 'relative', zIndex: 1 }}>{tag}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => update('Tags', form.Tags.filter((_, j) => j !== i))}
                  className="hover:text-red-400"
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              placeholder="Add tag"
              className="flex-1"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            />
            <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }} onClick={addTag}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </EditorSection>
  );
}
