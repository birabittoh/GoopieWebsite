import { useState } from 'react';
import { Link } from 'react-router';
import { Game, Platform, CVar, CVarType } from '../types/game';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Save, Trash2, Plus, CheckCircle2, Clock, Eye } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useGameStore } from '../data/GameStore';
import { isInLauncher, openExternal } from '../utils/externalLink';

interface GameEditorProps {
  game: Game | null; // null = creating new
  onSave: (game: Game) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  isNew?: boolean;
  readOnly?: boolean;
}

const statusOptions: Game['status'][] = ['Featured', 'Enhanced', 'Playable', 'Gameplay', 'Loads', 'Unplayable', 'Unknown'];
const ALL_PLATFORMS: Platform[] = ['Windows', 'Linux', 'Mac'];

export function GameEditor({ game, onSave, onDelete, onClose, isNew, readOnly }: GameEditorProps) {
  const { user } = useAuth();
  const { games } = useGameStore();
  const isAdmin = user?.role === 'admin';
  const [recompNameError, setRecompNameError] = useState('');
  const [form, setForm] = useState<Game>(game || {
    id: crypto.randomUUID(),
    title: '',
    recompName: '',
    og_developer: '',
    recompiled_developers: [],
    Tags: [],
    status: 'Unknown',
    coverImage: '',
    headerImage: [],
    description: '',
    isPublic: false,
    accentColor: '#000000',
    mediaLinks: [],
    platforms: ['Windows'],
    setGameDataRootToAssets: true,
    updateStatus: 'hidden',
    dlcNames: [],
  });

  const [devInput, setDevInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [mediaInput, setMediaInput] = useState('');
  const [headerImageInput, setHeaderImageInput] = useState('');
  const [audioInput, setAudioInput] = useState('');
  const [dlcNameInput, setDlcNameInput] = useState('');

  // Normalize headerImage to always be an array internally
  const headerImages: string[] = Array.isArray(form.headerImage) ? form.headerImage : (form.headerImage ? [form.headerImage] : []);
  const backgroundAudioLinks: string[] = Array.isArray(form.backgroundAudio) ? form.backgroundAudio : (form.backgroundAudio ? [form.backgroundAudio] : []);

  const update = <K extends keyof Game>(key: K, value: Game[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    // Check recomp name uniqueness (case-insensitive, exclude current game)
    const duplicate = games.find(
      g => g.recompName.toLowerCase() === form.recompName.toLowerCase() && g.id !== form.id
    );
    if (duplicate) {
      setRecompNameError(`Recomp name "${form.recompName}" is already used by "${duplicate.title}".`);
      return;
    }
    setRecompNameError('');
    onSave(form);
  };

  const inputStyle = { backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' } as React.CSSProperties;
  const labelClass = "text-sm mb-1 block";
  const labelStyle = { color: 'var(--theme-text-muted)' };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="rounded-lg border w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
        <div className="sticky top-0 border-b p-6 flex items-center justify-between z-10" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
            {readOnly && <Eye className="w-5 h-5" />}
            {isNew ? 'Create New Game' : `${readOnly ? 'Preview' : 'Edit'}: ${game?.title}`}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--theme-text-muted)' }}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    
          <fieldset disabled={readOnly} className="contents">
          {/* Title & Recomp Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Title *</label>
              <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Game title" style={inputStyle} required />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Recomp Name *</label>
              <Input value={form.recompName} onChange={e => { update('recompName', e.target.value); setRecompNameError(''); }} placeholder="e.g. renut" style={recompNameError ? { ...inputStyle, borderColor: '#ef4444' } : inputStyle} required />
              {recompNameError && <p className="text-red-500 text-xs mt-1">{recompNameError}</p>}
            </div>
          </div>

          {/* Developer & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Original Developer *</label>
              <Input value={form.og_developer} onChange={e => update('og_developer', e.target.value)} placeholder="e.g. Rare" style={inputStyle} required />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Status</label>
              <Select value={form.status} onValueChange={v => update('status', v as Game['status'])}>
                <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={inputStyle}>
                  {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Platforms */}
          <div>
            <label className={labelClass} style={labelStyle}>Platforms</label>
            <div className="flex gap-3">
              {ALL_PLATFORMS.map(p => (
                <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.platforms?.includes(p) ?? false}
                    onChange={e => {
                      const current = form.platforms || [];
                      if (e.target.checked) {
                        update('platforms', [...current, p]);
                      } else {
                        update('platforms', current.filter(x => x !== p));
                      }
                    }}
                    className="accent-[var(--theme-accent)]"
                  />
                  <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recompiled Developers */}
          <div>
            <label className={labelClass} style={labelStyle}>Recompiled Developers</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.recompiled_developers.map((dev, i) => (
                <span key={i} className="text-white px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
                  {dev}
                  <button type="button" onClick={() => update('recompiled_developers', form.recompiled_developers.filter((_, j) => j !== i))} className="hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={devInput} onChange={e => setDevInput(e.target.value)} placeholder="Add developer" className="flex-1" style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (devInput.trim()) { update('recompiled_developers', [...form.recompiled_developers, devInput.trim()]); setDevInput(''); }}}} />
              <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}
                onClick={() => { if (devInput.trim()) { update('recompiled_developers', [...form.recompiled_developers, devInput.trim()]); setDevInput(''); }}}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass} style={labelStyle}>Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.Tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded text-xs flex items-center gap-1 relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                    border: '1px solid var(--theme-border)'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 0,
                      opacity: 0.18,
                      background: 'repeating-linear-gradient(135deg, var(--theme-accent) 0 8px, transparent 8px 16px)'
                    }}
                  />
                  <span style={{ position: 'relative', zIndex: 1 }}>{tag}</span>
                  <button type="button" onClick={() => update('Tags', form.Tags.filter((_, j) => j !== i))} className="hover:text-red-400" style={{ position: 'relative', zIndex: 1 }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag" className="flex-1" style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (tagInput.trim()) { update('Tags', [...form.Tags, tagInput.trim()]); setTagInput(''); }}}} />
              <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}
                onClick={() => { if (tagInput.trim()) { update('Tags', [...form.Tags, tagInput.trim()]); setTagInput(''); }}}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Images */}
          <div>
            <label className={labelClass} style={labelStyle}>Cover Image URL *</label>
            <Input value={form.coverImage} onChange={e => update('coverImage', e.target.value)} placeholder="https://..." style={inputStyle} required />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Icon URL (for shortcuts; extracted from XEX if empty)</label>
            <Input value={form.iconUrl || ''} onChange={e => update('iconUrl', e.target.value || undefined)} placeholder="https://..." style={inputStyle} />
          </div>

          {/* Header Images (multiple, cycling) */}
          <div>
            <label className={labelClass} style={labelStyle}>Header Images (cycle every 7s) *</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {headerImages.map((url, i) => (
                <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
                  {url.length > 50 ? url.slice(0, 50) + '…' : url}
                  <button type="button" onClick={() => update('headerImage', headerImages.filter((_, j) => j !== i))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={headerImageInput} onChange={e => setHeaderImageInput(e.target.value)} placeholder="Add header image URL" className="flex-1" style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (headerImageInput.trim()) { update('headerImage', [...headerImages, headerImageInput.trim()]); setHeaderImageInput(''); }}}} />
              <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}
                onClick={() => { if (headerImageInput.trim()) { update('headerImage', [...headerImages, headerImageInput.trim()]); setHeaderImageInput(''); }}}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {headerImages.length === 0 && <p className="text-red-500 text-xs mt-1">At least one header image is required.</p>}
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Title Image URL (optional)</label>
            <Input value={form.titleImage || ''} onChange={e => update('titleImage', e.target.value || undefined)} placeholder="https://..." style={inputStyle} />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Title Size Multiplier (optional)</label>
            <Input
                type="number"
                value={form.titleSizeMultiplier || ''}
                onChange={e => update('titleSizeMultiplier', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g. 1.5"
                style={inputStyle}
                />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hideTitleText"
              checked={!!form.hideTitleText}
              onChange={e => update('hideTitleText', e.target.checked || undefined)}
              className="w-4 h-4 cursor-pointer"
            />
            <label htmlFor="hideTitleText" className={labelClass} style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
              Hide title text on Library page (use when title image already shows the game name)
            </label>
          </div>


          {/* Accent Color */}
          <div>
            <label className={labelClass} style={labelStyle}>Accent Color (used by PS3 theme background)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.accentColor || '#000000'}
                onChange={e => update('accentColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
              />
              <Input
                value={form.accentColor || '#000000'}
                onChange={e => update('accentColor', e.target.value)}
                placeholder="#000000"
                style={inputStyle}
                className="w-36"
              />
              <button
                type="button"
                onClick={() => update('accentColor', '#000000')}
                className="text-xs px-3 py-1.5 rounded"
                style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-muted)' }}
              >
                Reset
              </button>
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                #000000 = use theme default
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass} style={labelStyle}>Description *</label>
              <Link
                to="/markdown-reference"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline"
                style={{ color: 'var(--theme-accent)' }}
                onClick={(e) => {
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
              rows={4}
              required
              className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-y"
              style={inputStyle}
            />
          </div>

          {/* Visibility */}
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublic !== false}
                  onChange={e => { update('isPublic', e.target.checked); update('pendingApproval', false); }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 peer-checked:bg-[#5c7e10] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: form.isPublic !== false ? '#5c7e10' : 'var(--theme-item-selected)' }}></div>
              </label>
              <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>Public</span>
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {form.isPublic !== false ? '— Visible to everyone' : '— Only visible to admins and assigned developers'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {form.isPublic ? (
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--theme-accent)' }}>
                  <CheckCircle2 className="w-4 h-4" /> This game is public
                </span>
              ) : form.pendingApproval ? (
                <span className="text-sm flex items-center gap-2 text-yellow-500">
                  <Clock className="w-4 h-4" /> Public visibility requested — awaiting admin approval
                </span>
              ) : (
                <Button
                  type="button"
                  onClick={() => update('pendingApproval', true)}
                  className="text-white"
                  style={{ backgroundColor: 'var(--theme-item-selected)' }}
                >
                  <Clock className="w-4 h-4 mr-2" /> Request Public
                </Button>
              )}
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {form.isPublic ? '' : '— An admin must approve before this game becomes public'}
              </span>
            </div>
          )}

          {/* Social Links */}
          <div>
            <label className={`${labelClass} mb-3`} style={labelStyle}>Social Links</label>
            <div className="grid grid-cols-2 gap-3">
              {(['discord', 'twitter', 'bluesky', 'youtube', 'patreon', 'kofi', 'website', 'github', 'reddit'] as const).map(key => (
                <div key={key}>
                  <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--theme-text-muted)' }}>{key}</label>
                  <Input
                    value={form.socialLinks?.[key] || ''}
                    onChange={e => {
                      const copy = { ...form.socialLinks };
                      if (e.target.value) {
                        copy[key] = e.target.value;
                      } else {
                        delete copy[key];
                      }
                      update('socialLinks', copy);
                    }}
                    placeholder={`https://...`}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Discord Guild ID <span className="opacity-60">(for embedded widget — right-click server icon → Copy Server ID)</span></label>
              <Input
                value={form.discordGuildId || ''}
                onChange={e => update('discordGuildId', e.target.value || undefined)}
                placeholder="e.g. 1513356298874388640"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Disable Save Manager */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.disableSaveManager === true}
                onChange={e => update('disableSaveManager', e.target.checked || undefined)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 peer-checked:bg-red-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: form.disableSaveManager ? undefined : 'var(--theme-item-selected)' }}></div>
            </label>
            <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>Disable Save Manager</span>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {form.disableSaveManager ? '— Save manager is hidden for this game' : '— Save manager is available'}
            </span>
          </div>

          {/* Launcher game_data_root behavior */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.setGameDataRootToAssets === true}
                onChange={e => update('setGameDataRootToAssets', e.target.checked || undefined)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 peer-checked:bg-[#5c7e10] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: form.setGameDataRootToAssets ? undefined : 'var(--theme-item-selected)' }}></div>
            </label>
            <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>Set game_data_root to assets folder</span>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {form.setGameDataRootToAssets ? '— Adds --game_data_root=".../assets" when launching' : '— Do not pass --game_data_root'}
            </span>
          </div>

          {/* Xenos renderer */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.useXenosRenderer === true}
                onChange={e => update('useXenosRenderer', e.target.checked || undefined)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 peer-checked:bg-[#5c7e10] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: form.useXenosRenderer ? undefined : 'var(--theme-item-selected)' }}></div>
            </label>
            <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>Xenos renderer</span>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {form.useXenosRenderer ? '— Launches with --gpu_plugin xenos' : '— Native renderer'}
            </span>
          </div>

          {/* XBLA toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isXBLA === true}
                onChange={e => update('isXBLA', e.target.checked || undefined)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 peer-checked:bg-[#5c7e10] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: form.isXBLA ? undefined : 'var(--theme-item-selected)' }}></div>
            </label>
            <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>XBLA</span>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {form.isXBLA ? '— No file filter on extract; launches with --license_mask=1' : '— Extract filters for .iso files'}
            </span>
          </div>

          {/* External Launcher URL */}
          <div>
            <label className={labelClass} style={labelStyle}>External Launcher URL (optional)</label>
            <Input
              value={form.externalLauncherUrl || ''}
              onChange={e => update('externalLauncherUrl', e.target.value || undefined)}
              placeholder="https://..."
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              For games that use a proprietary launcher. A download/link button will be shown on the game page instead of using the built-in launcher.
            </p>
          </div>

          {/* Background Audio Links */}
          <div>
            <label className={labelClass} style={labelStyle}>Background Audio (YouTube URLs, one picked randomly)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {backgroundAudioLinks.map((url, i) => (
                <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
                  {url.length > 50 ? url.slice(0, 50) + '…' : url}
                  <button type="button" onClick={() => { const next = backgroundAudioLinks.filter((_, j) => j !== i); update('backgroundAudio', next.length ? next : undefined); }} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={audioInput} onChange={e => setAudioInput(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="flex-1" style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (audioInput.trim()) { update('backgroundAudio', [...backgroundAudioLinks, audioInput.trim()]); setAudioInput(''); }}}} />
              <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}
                onClick={() => { if (audioInput.trim()) { update('backgroundAudio', [...backgroundAudioLinks, audioInput.trim()]); setAudioInput(''); }}}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              One is randomly picked each time the game is clicked. Loops in the background.
            </p>
          </div>

          {/* Media Links */}
                    <div>
                      <label className={labelClass} style={labelStyle}>Media Links (YouTube or image URLs)</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.mediaLinks?.map((link, i) => (
                          <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
                            {link}
                            <button type="button" onClick={() => update('mediaLinks', form.mediaLinks?.filter((_, j) => j !== i))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input value={mediaInput} onChange={e => setMediaInput(e.target.value)} placeholder="Add YouTube or image URL" className="flex-1" style={inputStyle}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (mediaInput.trim()) { update('mediaLinks', [...(form.mediaLinks || []), mediaInput.trim()]); setMediaInput(''); }}}} />
                        <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}
                          onClick={() => { if (mediaInput.trim()) { update('mediaLinks', [...(form.mediaLinks || []), mediaInput.trim()]); setMediaInput(''); }}}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

          {/* CVars — launcher-exposed runtime settings */}
          <div>
            <label className={`${labelClass} mb-3`} style={labelStyle}>Launcher CVars</label>
            <p className="text-xs mb-3" style={{ color: 'var(--theme-text-muted)' }}>
              Variables shown to the player as a settings panel. Sent to the game on launch as
              <code className="mx-1 px-1 rounded" style={{ backgroundColor: 'var(--theme-page-bg)' }}>-tag value</code>
              pairs (e.g. <code className="px-1 rounded" style={{ backgroundColor: 'var(--theme-page-bg)' }}>-console true -numberofcoins 999 -health 1.0</code>).
              The <em>tag</em> is the command-line flag; the <em>display name</em> is what the player sees.
            </p>
            <div className="space-y-3">
              {(form.cvars || []).map((cv, i) => {
                const updateCv = (patch: Partial<CVar>) => {
                  const next = [...(form.cvars || [])];
                  next[i] = { ...next[i], ...patch };
                  update('cvars', next);
                };
                const removeCv = () => {
                  update('cvars', (form.cvars || []).filter((_, j) => j !== i));
                };
                const tagError = cv.tag && !/^[A-Za-z0-9_]+$/.test(cv.tag);
                return (
                  <div key={cv.id} className="rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-page-bg)' }}>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-4">
                        <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Display Name</label>
                        <Input value={cv.displayName} onChange={e => updateCv({ displayName: e.target.value })} placeholder="Number of coins" style={inputStyle} />
                      </div>
                      <div className="col-span-7 md:col-span-3">
                        <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Tag</label>
                        <Input
                          value={cv.tag}
                          onChange={e => updateCv({ tag: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                          placeholder="numberofcoins"
                          style={tagError ? { ...inputStyle, borderColor: '#ef4444' } : inputStyle}
                        />
                      </div>
                      <div className="col-span-5 md:col-span-2">
                        <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Type</label>
                        <Select
                          value={cv.type}
                          onValueChange={v => {
                            const t = v as CVarType;
                            const def: number | boolean = t === 'Bool' ? false : 0;
                            updateCv({ type: t, defaultValue: def });
                          }}
                        >
                          <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent style={inputStyle}>
                            <SelectItem value="Int">Int</SelectItem>
                            <SelectItem value="Float">Float</SelectItem>
                            <SelectItem value="Bool">Bool</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-10 md:col-span-2">
                        <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Default</label>
                        {cv.type === 'Bool' ? (
                          <Select
                            value={cv.defaultValue ? 'true' : 'false'}
                            onValueChange={v => updateCv({ defaultValue: v === 'true' })}
                          >
                            <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent style={inputStyle}>
                              <SelectItem value="false">false</SelectItem>
                              <SelectItem value="true">true</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type="number"
                            step={cv.type === 'Float' ? 'any' : '1'}
                            value={typeof cv.defaultValue === 'number' ? cv.defaultValue : 0}
                            onChange={e => {
                              const n = e.target.value === '' ? 0 : Number(e.target.value);
                              if (!isFinite(n)) return;
                              updateCv({ defaultValue: cv.type === 'Int' ? Math.trunc(n) : n });
                            }}
                            style={inputStyle}
                          />
                        )}
                      </div>
                      <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                        <Button type="button" size="sm" onClick={removeCv} className="bg-red-600 hover:bg-red-700 text-white" title="Remove cvar">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="col-span-12">
                        <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Description (optional)</label>
                        <Input value={cv.description || ''} onChange={e => updateCv({ description: e.target.value || undefined })} placeholder="Shown to the player in the settings panel" style={inputStyle} />
                      </div>
                    </div>
                    {tagError && <p className="text-red-500 text-xs mt-2">Tag must be letters, digits, or underscores only.</p>}
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              className="text-white mt-3"
              style={{ backgroundColor: 'var(--theme-item-selected)' }}
              onClick={() => {
                const newCv: CVar = {
                  id: crypto.randomUUID(),
                  displayName: '',
                  tag: '',
                  type: 'Bool',
                  defaultValue: false,
                };
                update('cvars', [...(form.cvars || []), newCv]);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Add CVar
            </Button>
          </div>

          {/* XEX info */}
          <div>
            <label className={`${labelClass} mb-3`} style={labelStyle}>XEX Info</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>XEX SHA256</label>
                <Input
                  value={form.xexSha256 || ''}
                  onChange={e => update('xexSha256', e.target.value || undefined)}
                  placeholder="e.g. d3a5..."
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>XEX Version</label>
                <Input
                  value={form.xexVersion || ''}
                  onChange={e => update('xexVersion', e.target.value || undefined)}
                  placeholder="e.g. World, USA, PAL"
                  style={inputStyle}
                />
              </div>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              Identifies the exact XEX revision the recomp expects.
            </p>
          </div>

          {/* Update & DLC */}
          <div>
            <label className={`${labelClass} mb-3`} style={labelStyle}>Update &amp; DLC</label>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Update Status</label>
                <Select value={form.updateStatus || 'hidden'} onValueChange={v => update('updateStatus', v as Game['updateStatus'])}>
                  <SelectTrigger className="w-full rounded-md text-sm border" style={inputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={inputStyle}>
                    <SelectItem value="hidden">Hidden</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="required">Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>Update Checksum (SHA-256)</label>
                <Input
                  value={form.updateChecksum || ''}
                  onChange={e => update('updateChecksum', e.target.value || undefined)}
                  placeholder="e.g. a1b2c3..."
                  style={inputStyle}
                />
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
                />
              </div>
            )}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>DLC Names</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(form.dlcNames || []).map((name, i) => (
                  <span key={i} className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-accent)' }}>
                    {name}
                    <button type="button" onClick={() => update('dlcNames', (form.dlcNames || []).filter((_, j) => j !== i))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={dlcNameInput} onChange={e => setDlcNameInput(e.target.value)} placeholder="Add DLC name" className="flex-1" style={inputStyle}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (dlcNameInput.trim()) { update('dlcNames', [...(form.dlcNames || []), dlcNameInput.trim()]); setDlcNameInput(''); }}}} />
                <Button type="button" size="sm" className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}
                  onClick={() => { if (dlcNameInput.trim()) { update('dlcNames', [...(form.dlcNames || []), dlcNameInput.trim()]); setDlcNameInput(''); }}}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              Known DLC display names. Matched against STFS package headers when players install DLC files.
            </p>
          </div>

          {/* Game Files (GitHub release links) */}          <div>
            <label className={`${labelClass} mb-3`} style={labelStyle}>Game Files</label>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>GitHub Release URL</label>
                <Input
                  value={form.githubReleaseUrl || ''}
                  onChange={e => update('githubReleaseUrl', e.target.value || undefined)}
                  placeholder="https://github.com/user/repo/releases/latest/download/"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>GitHub API URL (for update checks)</label>
                <Input
                  value={form.githubApiUrl || ''}
                  onChange={e => update('githubApiUrl', e.target.value || undefined)}
                  placeholder="https://api.github.com/repos/owner/repo/releases/latest"
                  style={inputStyle}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                The naming convention is important for the launcher to recognize the files. i.e "[recompName].exe" You can also optionally have a [recompName].toml with the release.
              </p>
            </div>
          </div>

          </fieldset>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            <div>
              {!isNew && !readOnly && onDelete && (
                <Button type="button" onClick={() => { onDelete(form.id); onClose(); }} className="bg-red-600 hover:bg-red-700 text-white">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Game
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" onClick={onClose} className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
                {readOnly ? 'Close' : 'Cancel'}
              </Button>
              {!readOnly && (
                <Button type="submit" className="text-white" style={{ backgroundColor: 'var(--theme-accent)' }}>
                  <Save className="w-4 h-4 mr-2" /> {isNew ? 'Create Game' : 'Save Changes'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
