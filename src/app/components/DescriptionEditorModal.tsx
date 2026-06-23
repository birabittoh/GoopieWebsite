import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from './ui/button';
import type { Game } from '../types/game';
import { isInLauncher, openExternal as openExternalUrl } from '../utils/externalLink';

export function DescriptionEditorModal({
  game,
  onSave,
  onClose,
}: {
  game: Game;
  onSave: (description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(game.description);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="rounded-lg border w-full max-w-3xl flex flex-col" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Edit Description</h2>
          <div className="flex items-center gap-2">
            <Link
              to="/markdown-reference"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline"
              style={{ color: 'var(--theme-accent)' }}
              onClick={(e) => {
                if (isInLauncher()) {
                  e.preventDefault();
                  openExternalUrl(`${window.location.origin}/#/markdown-reference`);
                }
              }}
            >
              Markdown reference ↗
            </Link>
            <button onClick={onClose} style={{ color: 'var(--theme-text-muted)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-none font-mono"
            style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', height: '60vh', minHeight: '300px' }}
            placeholder="Game description..."
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <Button type="button" onClick={onClose} style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}>
            Cancel
          </Button>
          <Button
            type="button"
            className="text-white"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            onClick={async () => {
              await onSave(draft);
              onClose();
            }}
          >
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}
