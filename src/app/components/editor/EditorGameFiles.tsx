import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { Game } from '../../types/game';
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

export function EditorGameFiles({ form, update, readOnly }: Props) {
  const [dlcNameInput, setDlcNameInput] = useState('');

  const addDlc = () => {
    if (!dlcNameInput.trim()) return;
    update('dlcNames', [...(form.dlcNames || []), dlcNameInput.trim()]);
    setDlcNameInput('');
  };

  return (
    <EditorSection title="Game Files">
      {/* XEX Info */}
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--theme-text-muted)' }}>XEX Info</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>XEX SHA256</label>
            <Input value={form.xexSha256 || ''} onChange={e => update('xexSha256', e.target.value || undefined)} placeholder="e.g. d3a5..." style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>XEX Version</label>
            <Input value={form.xexVersion || ''} onChange={e => update('xexVersion', e.target.value || undefined)} placeholder="e.g. World, USA, PAL" style={inputStyle} disabled={readOnly} />
          </div>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>Identifies the exact XEX revision the recomp expects.</p>
      </div>

      {/* GitHub Release */}
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--theme-text-muted)' }}>GitHub Release</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Release URL</label>
            <Input value={form.githubReleaseUrl || ''} onChange={e => update('githubReleaseUrl', e.target.value || undefined)} placeholder="https://github.com/user/repo/releases/latest/download/" style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>API URL (for update checks)</label>
            <Input value={form.githubApiUrl || ''} onChange={e => update('githubApiUrl', e.target.value || undefined)} placeholder="https://api.github.com/repos/owner/repo/releases/latest" style={inputStyle} disabled={readOnly} />
          </div>
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            File naming convention:{' '}
            <code className="px-1 rounded" style={{ backgroundColor: 'var(--theme-page-bg)' }}>[recompName].exe</code>. An optional{' '}
            <code className="px-1 rounded" style={{ backgroundColor: 'var(--theme-page-bg)' }}>[recompName].toml</code> can be bundled with the release.
          </p>
        </div>
      </div>

      {/* Update & DLC */}
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--theme-text-muted)' }}>Update & DLC</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Update Status</label>
            <Select value={form.updateStatus || 'hidden'} onValueChange={v => update('updateStatus', v as Game['updateStatus'])} disabled={readOnly}>
              <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}><SelectValue /></SelectTrigger>
              <SelectContent style={inputStyle}>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="optional">Optional</SelectItem>
                <SelectItem value="required">Required</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Update Checksum (SHA-256)</label>
            <Input value={form.updateChecksum || ''} onChange={e => update('updateChecksum', e.target.value || undefined)} placeholder="e.g. a1b2c3..." style={inputStyle} disabled={readOnly} />
          </div>
        </div>
        {form.updateStatus === 'optional' && (
          <div className="mb-3">
            <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Title Update Build Regex</label>
            <Input
              value={form.updateBuildPattern || ''}
              onChange={e => update('updateBuildPattern', e.target.value || undefined)}
              placeholder="e.g. ^tu-"
              style={inputStyle}
              disabled={readOnly}
            />
          </div>
        )}
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>DLC Names</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(form.dlcNames || []).map((name, i) => (
              <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
                {name}
                {!readOnly && (
                  <button type="button" onClick={() => update('dlcNames', (form.dlcNames || []).filter((_, j) => j !== i))} className="hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Input
                value={dlcNameInput}
                onChange={e => setDlcNameInput(e.target.value)}
                placeholder="Add DLC name"
                className="flex-1"
                style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDlc(); } }}
              />
              <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }} onClick={addDlc}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            Matched against STFS package headers when players install DLC files.
          </p>
        </div>
      </div>
    </EditorSection>
  );
}
