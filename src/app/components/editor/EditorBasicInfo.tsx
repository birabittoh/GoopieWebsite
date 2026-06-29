import type { Game } from '../../types/game';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditorSection } from './EditorSection';
import { inputStyle, labelClass, labelStyle } from './editorStyles';

const STATUS_OPTIONS: Game['status'][] = ['Featured', 'Enhanced', 'Playable', 'Gameplay', 'Loads', 'Unplayable', 'Unknown'];

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
  recompNameError: string;
  onRecompNameChange: (value: string) => void;
}

export function EditorBasicInfo({ form, update, readOnly, recompNameError, onRecompNameChange }: Props) {
  return (
    <EditorSection title="Basic Info">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Title *</label>
          <Input
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="Game title"
            style={inputStyle}
            required
            disabled={readOnly}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Recomp Name *</label>
          <Input
            value={form.recompName}
            onChange={e => onRecompNameChange(e.target.value)}
            placeholder="e.g. renut"
            style={recompNameError ? { ...inputStyle, borderColor: '#ef4444' } : inputStyle}
            required
            disabled={readOnly}
          />
          {recompNameError && <p className="text-red-500 text-xs mt-1">{recompNameError}</p>}
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Original Developer *</label>
          <Input
            value={form.og_developer}
            onChange={e => update('og_developer', e.target.value)}
            placeholder="e.g. Rare"
            style={inputStyle}
            required
            disabled={readOnly}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Status</label>
          <Select value={form.status} onValueChange={v => update('status', v as Game['status'])} disabled={readOnly}>
            <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={inputStyle}>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </EditorSection>
  );
}
