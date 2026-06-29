import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Link } from 'react-router';
import type { Game } from '../../types/game';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditorSection } from './EditorSection';
import { inputStyle, labelClass, labelStyle } from './editorStyles';
import { isInLauncher, openExternal } from '../../utils/externalLink';

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
}

export function EditorDescriptionMedia({ form, update, readOnly }: Props) {
  const [audioInput, setAudioInput] = useState('');
  const [mediaInput, setMediaInput] = useState('');

  const audioLinks: string[] = Array.isArray(form.backgroundAudio)
    ? form.backgroundAudio
    : form.backgroundAudio ? [form.backgroundAudio] : [];

  const addAudio = () => {
    if (!audioInput.trim()) return;
    update('backgroundAudio', [...audioLinks, audioInput.trim()]);
    setAudioInput('');
  };

  const addMedia = () => {
    if (!mediaInput.trim()) return;
    update('mediaLinks', [...(form.mediaLinks || []), mediaInput.trim()]);
    setMediaInput('');
  };

  return (
    <EditorSection title="Description & Media">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass} style={labelStyle}>Description *</label>
          <Link
            to="/markdown-reference"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline"
            style={{ color: 'var(--theme-accent)' }}
            onClick={e => {
              if (isInLauncher()) {
                e.preventDefault();
                openExternal(`${window.location.origin}/#/markdown-reference`);
              }
            }}
          >
            Markdown reference ↗
          </Link>
        </div>
        <textarea
          value={form.description}
          onChange={e => update('description', e.target.value)}
          placeholder="Game description..."
          rows={5}
          required
          disabled={readOnly}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-y"
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Background Audio (YouTube URLs, one picked randomly)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {audioLinks.map((url, i) => (
            <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
              {url.length > 50 ? url.slice(0, 50) + '…' : url}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const next = audioLinks.filter((_, j) => j !== i);
                    update('backgroundAudio', next.length ? next : undefined);
                  }}
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
              value={audioInput}
              onChange={e => setAudioInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAudio(); } }}
            />
            <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }} onClick={addAudio}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          One is randomly picked each time the game is clicked. Loops in the background.
        </p>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Media Links (YouTube or image URLs)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(form.mediaLinks || []).map((link, i) => (
            <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
              {link.length > 50 ? link.slice(0, 50) + '…' : link}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => update('mediaLinks', (form.mediaLinks || []).filter((_, j) => j !== i))}
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
              value={mediaInput}
              onChange={e => setMediaInput(e.target.value)}
              placeholder="Add YouTube or image URL"
              className="flex-1"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMedia(); } }}
            />
            <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }} onClick={addMedia}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </EditorSection>
  );
}
