import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { Game, CVar, CVarType } from '../../types/game';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditorSection } from './EditorSection';
import { inputStyle, labelStyle } from './editorStyles';

interface Props {
  form: Game;
  update: <K extends keyof Game>(key: K, value: Game[K]) => void;
  readOnly: boolean;
}

interface RowProps {
  cv: CVar;
  i: number;
  updateCv: (i: number, patch: Partial<CVar>) => void;
  removeCv: (i: number) => void;
  readOnly: boolean;
}

function CVarRow({ cv, i, updateCv, removeCv, readOnly }: RowProps) {
  const [rawOptions, setRawOptions] = useState((cv.options ?? []).join(', '));
  const parsedOptions = rawOptions.split(',').map(s => s.trim()).filter(Boolean);

  const tagError = cv.tag && !/^[A-Za-z0-9_]+$/.test(cv.tag);

  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-page-bg)' }}>
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-4">
          <label className="text-xs mb-1 block" style={labelStyle}>Display Name</label>
          <Input value={cv.displayName} onChange={e => updateCv(i, { displayName: e.target.value })} placeholder="Number of coins" style={inputStyle} disabled={readOnly} />
        </div>
        <div className="col-span-7 md:col-span-3">
          <label className="text-xs mb-1 block" style={labelStyle}>Tag</label>
          <Input
            value={cv.tag}
            onChange={e => updateCv(i, { tag: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
            placeholder="numberofcoins"
            style={tagError ? { ...inputStyle, borderColor: '#ef4444' } : inputStyle}
            disabled={readOnly}
          />
        </div>
        <div className="col-span-5 md:col-span-2">
          <label className="text-xs mb-1 block" style={labelStyle}>Type</label>
          <Select
            value={cv.type}
            onValueChange={v => {
              const t = v as CVarType;
              if (t === 'Enum') {
                setRawOptions('');
                updateCv(i, { type: t, defaultValue: '', options: [] });
              } else if (t === 'String') {
                updateCv(i, { type: t, defaultValue: '', options: undefined });
              } else {
                updateCv(i, { type: t, defaultValue: t === 'Bool' ? false : 0, options: undefined });
              }
            }}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent style={inputStyle}>
              <SelectItem value="Int">Int</SelectItem>
              <SelectItem value="Float">Float</SelectItem>
              <SelectItem value="Bool">Bool</SelectItem>
              <SelectItem value="Enum">Enum</SelectItem>
              <SelectItem value="String">String</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-10 md:col-span-2">
          <label className="text-xs mb-1 block" style={labelStyle}>Default</label>
          {cv.type === 'Bool' ? (
            <Select value={cv.defaultValue ? 'true' : 'false'} onValueChange={v => updateCv(i, { defaultValue: v === 'true' })} disabled={readOnly}>
              <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}><SelectValue /></SelectTrigger>
              <SelectContent style={inputStyle}>
                <SelectItem value="false">false</SelectItem>
                <SelectItem value="true">true</SelectItem>
              </SelectContent>
            </Select>
          ) : cv.type === 'Enum' ? (
            <Select
              value={String(cv.defaultValue)}
              onValueChange={v => updateCv(i, { defaultValue: v })}
              disabled={readOnly || parsedOptions.length === 0}
            >
              <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent style={inputStyle}>
                {parsedOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : cv.type === 'String' ? (
            <Input
              value={typeof cv.defaultValue === 'string' ? cv.defaultValue : ''}
              onChange={e => updateCv(i, { defaultValue: e.target.value })}
              placeholder="value"
              style={inputStyle}
              disabled={readOnly}
            />
          ) : (
            <Input
              type="number"
              step={cv.type === 'Float' ? 'any' : '1'}
              value={typeof cv.defaultValue === 'number' ? cv.defaultValue : 0}
              onChange={e => {
                const n = e.target.value === '' ? 0 : Number(e.target.value);
                if (!isFinite(n)) return;
                updateCv(i, { defaultValue: cv.type === 'Int' ? Math.trunc(n) : n });
              }}
              style={inputStyle}
              disabled={readOnly}
            />
          )}
        </div>
        {!readOnly && (
          <div className="col-span-2 md:col-span-1 flex items-end justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => removeCv(i)}
              className="bg-red-600 hover:bg-red-700 text-white"
              title="Remove cvar"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {cv.type === 'Enum' && (
          <div className="col-span-12">
            <label className="text-xs mb-1 block" style={labelStyle}>Options (comma-separated)</label>
            <Input
              value={rawOptions}
              onChange={e => {
                const raw = e.target.value;
                setRawOptions(raw);
                const opts = raw.split(',').map(s => s.trim()).filter(Boolean);
                const cur = String(cv.defaultValue);
                updateCv(i, { options: opts, defaultValue: opts.includes(cur) ? cur : (opts[0] ?? '') });
              }}
              placeholder="low, medium, high"
              style={inputStyle}
              disabled={readOnly}
            />
          </div>
        )}
        <div className="col-span-12">
          <label className="text-xs mb-1 block" style={labelStyle}>Description (optional)</label>
          <Input
            value={cv.description || ''}
            onChange={e => updateCv(i, { description: e.target.value || undefined })}
            placeholder="Shown to the player in the settings panel"
            style={inputStyle}
            disabled={readOnly}
          />
        </div>
      </div>
      {tagError && <p className="text-red-500 text-xs mt-2">Tag must be letters, digits, or underscores only.</p>}
    </div>
  );
}

export function EditorCVars({ form, update, readOnly }: Props) {
  const cvars = form.cvars || [];

  const updateCv = (i: number, patch: Partial<CVar>) => {
    const next = [...cvars];
    const merged = { ...next[i], ...patch };
    for (const key of Object.keys(merged) as (keyof CVar)[]) {
      if (merged[key] === undefined) delete merged[key];
    }
    next[i] = merged as CVar;
    update('cvars', next);
  };

  return (
    <EditorSection title="Launcher CVars">
      <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
        Variables shown to the player as a settings panel. Sent to the game on launch as{' '}
        <code className="mx-1 px-1 rounded" style={{ backgroundColor: 'var(--theme-page-bg)' }}>-tag value</code>
        pairs. The <em>tag</em> is the command-line flag; the <em>display name</em> is what the player sees.
      </p>

      <div className="space-y-3">
        {cvars.map((cv, i) => (
          <CVarRow
            key={cv.id}
            cv={cv}
            i={i}
            updateCv={updateCv}
            removeCv={i => update('cvars', cvars.filter((_, j) => j !== i))}
            readOnly={readOnly}
          />
        ))}
      </div>

      {!readOnly && (
        <Button
          type="button"
          size="sm"
          className="text-white"
          style={{ backgroundColor: 'var(--theme-item-selected)' }}
          onClick={() => update('cvars', [...cvars, { id: crypto.randomUUID(), displayName: '', tag: '', type: 'Bool', defaultValue: false }])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add CVar
        </Button>
      )}
    </EditorSection>
  );
}
