import { CheckCircle2, Clock } from 'lucide-react';
import type { Game } from '../../types/game';
import { Button } from '../ui/button';
import { EditorSection } from './EditorSection';

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  isAdmin: boolean;
  readOnly: boolean;
}

export function EditorVisibility({ form, update, isAdmin, readOnly }: Props) {
  return (
    <EditorSection title="Visibility">
      {isAdmin ? (
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={form.isPublic !== false}
              onChange={e => { update('isPublic', e.target.checked); update('pendingApproval', false); }}
              disabled={readOnly}
              className="sr-only peer"
            />
            <div
              className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
              style={{ backgroundColor: form.isPublic !== false ? '#5c7e10' : 'var(--theme-item-selected)' }}
            />
          </label>
          <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>Public</span>
          <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            {form.isPublic !== false ? '— Visible to everyone' : '— Only visible to admins and assigned developers'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          {form.isPublic ? (
            <span className="text-sm flex items-center gap-2" style={{ color: 'var(--theme-accent)' }}>
              <CheckCircle2 className="w-4 h-4" /> This game is public
            </span>
          ) : form.pendingApproval ? (
            <span className="text-sm flex items-center gap-2 text-yellow-500">
              <Clock className="w-4 h-4" /> Public visibility requested — awaiting admin approval
            </span>
          ) : (
            !readOnly && (
              <Button type="button" onClick={() => update('pendingApproval', true)} className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
                <Clock className="w-4 h-4 mr-2" /> Request Public
              </Button>
            )
          )}
          {!form.isPublic && (
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              An admin must approve before this game becomes public
            </span>
          )}
        </div>
      )}
    </EditorSection>
  );
}
