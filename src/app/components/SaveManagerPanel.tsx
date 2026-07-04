import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Upload, Trash2, RefreshCw, Plus, Pencil, Check, X, FolderOpen, FilePlus, Cloud } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

interface SaveSlot {
  name: string;
}

interface SaveManagerPanelProps {
  recompName: string;
}

interface CloudSaveStatus {
  enabled: boolean;
  signedIn: boolean;
  lastSyncedAt: number;
  syncing: boolean;
  error: string | null;
}

/// Coarse "5 minutes ago" / "3 hours ago" style formatting for the cloud-sync
/// status line — precision doesn't matter here, just a rough sense of freshness.
function formatRelativeTime(epochSeconds: number): string {
  if (!epochSeconds) return 'never';
  const diffSeconds = Math.max(0, Date.now() / 1000 - epochSeconds);
  if (diffSeconds < 60) return 'just now';
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function SaveManagerPanel({ recompName }: SaveManagerPanelProps) {
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [activeSave, setActiveSave] = useState<string>('');
  const [newSaveName, setNewSaveName] = useState('');
  const [renamingSlot, setRenamingSlot] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const messageTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInCEF = !!(window as any).getSaveSlots;

  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
    messageTimeout.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  // ── Cloud saves (Google Drive) ──────────────────────────────────────────────
  // Gated on 1.6.1 — the same release that ships the bridge commands this UI
  // calls (see shim.js). Old launchers simply don't render this section.
  const cloudSupported = isLauncherVersionAtLeast('1.6.1') && typeof (window as any).getCloudSaveStatus === 'function';
  const [cloudStatus, setCloudStatus] = useState<CloudSaveStatus | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);

  useEffect(() => {
    if (!cloudSupported || !recompName) return;
    const poll = () => {
      const s = (window as any).getCloudSaveStatus(recompName);
      if (s) setCloudStatus(s);
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [cloudSupported, recompName]);

  const handleToggleCloudSave = useCallback(async (next: boolean) => {
    if (!recompName) return;
    setCloudBusy(true);
    const w = window as any;
    try {
      let result = w.setCloudSaveEnabled(recompName, next);
      if (next && result?.needsConsent) {
        w.cloudSaveSignIn();
        // Poll the system-browser consent flow (mirrors the GoogleSignIn
        // pattern) until it resolves or times out.
        const deadline = Date.now() + 5 * 60 * 1000;
        let signIn = w.getCloudSaveSignInResult();
        while (signIn?.status === 'pending' || signIn?.status === 'idle') {
          if (Date.now() > deadline) {
            showMessage('Cloud save sign-in timed out', 'error');
            setCloudBusy(false);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          signIn = w.getCloudSaveSignInResult();
        }
        if (signIn?.status !== 'ok') {
          showMessage(signIn?.message || 'Cloud save sign-in failed', 'error');
          setCloudBusy(false);
          return;
        }
        result = w.setCloudSaveEnabled(recompName, true);
      }
      if (result?.ok) {
        setCloudStatus(w.getCloudSaveStatus(recompName));
        showMessage(next ? 'Cloud saves enabled' : 'Cloud saves disabled', 'success');
      } else {
        showMessage('Could not update cloud saves', 'error');
      }
    } catch {
      showMessage('Could not update cloud saves', 'error');
    }
    setCloudBusy(false);
  }, [recompName, showMessage]);

  const refreshSlots = useCallback(() => {
    if (!recompName || !isInCEF) return;
    const w = window as any;
    const names: string[] = w.getSaveSlots(recompName) ?? [];
    setSlots(names.map(name => ({ name })));
    setActiveSave(w.getActiveSave ? w.getActiveSave(recompName) ?? '' : '');
  }, [recompName, isInCEF]);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const handleBackup = useCallback(() => {
    if (!recompName || !newSaveName.trim()) return;
    setLoading(true);
    try {
      const ok = (window as any).backupSave(recompName, newSaveName.trim());
      if (ok) {
        showMessage(`Saved "${newSaveName.trim()}" successfully`, 'success');
        setNewSaveName('');
        refreshSlots();
      } else {
        showMessage('Backup failed', 'error');
      }
    } catch {
      showMessage('Backup failed', 'error');
    }
    setLoading(false);
  }, [recompName, newSaveName, refreshSlots, showMessage]);

  const handleRestore = useCallback((slotName: string) => {
    if (!recompName) return;
    setLoading(true);
    try {
      const ok = (window as any).restoreSave(recompName, slotName);
      if (ok) {
        showMessage(`Loaded "${slotName}"`, 'success');
        setActiveSave(slotName);
      } else {
        showMessage('Restore failed', 'error');
      }
    } catch {
      showMessage('Restore failed', 'error');
    }
    setLoading(false);
  }, [recompName, showMessage]);

  const handleDelete = useCallback((slotName: string) => {
    if (!recompName) return;
    setLoading(true);
    try {
      const ok = (window as any).deleteSave(recompName, slotName);
      if (ok) {
        showMessage(`Deleted "${slotName}"`, 'success');
        refreshSlots();
      } else {
        showMessage('Delete failed', 'error');
      }
    } catch {
      showMessage('Delete failed', 'error');
    }
    setLoading(false);
  }, [recompName, refreshSlots, showMessage]);

  const handleCreateNewSave = useCallback((backupFirst: boolean) => {
    if (!recompName) return;
    const w = window as any;
    const trimmed = createName.trim();
    if (backupFirst && !trimmed) return;
    setLoading(true);
    try {
      if (backupFirst) {
        const backed = w.backupSave ? w.backupSave(recompName, trimmed) : false;
        if (!backed) {
          showMessage('Backup failed — current save was not deleted', 'error');
          setLoading(false);
          return;
        }
      }
      const deleted = w.deleteCurrentSave ? w.deleteCurrentSave(recompName) : false;
      if (deleted) {
        showMessage(
          backupFirst
            ? `Backed up as "${trimmed}" and cleared current save`
            : 'Current save discarded — a new save will be created on next launch',
          'success',
        );
        setCreateOpen(false);
        setCreateName('');
        refreshSlots();
      } else {
        showMessage('Failed to delete current save', 'error');
      }
    } catch {
      showMessage('Failed to create new save', 'error');
    }
    setLoading(false);
  }, [recompName, createName, refreshSlots, showMessage]);

  const handleRename = useCallback((oldName: string) => {
    if (!recompName || !renameValue.trim() || renameValue.trim() === oldName) {
      setRenamingSlot(null);
      return;
    }
    setLoading(true);
    try {
      const ok = (window as any).renameSave(recompName, oldName, renameValue.trim());
      if (ok) {
        showMessage(`Renamed to "${renameValue.trim()}"`, 'success');
        refreshSlots();
      } else {
        showMessage('Rename failed', 'error');
      }
    } catch {
      showMessage('Rename failed', 'error');
    }
    setRenamingSlot(null);
    setLoading(false);
  }, [recompName, renameValue, refreshSlots, showMessage]);

  if (!isInCEF) {
    return (
      <div className="p-6 rounded-lg text-center" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
        <FolderOpen className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--theme-text-muted)' }} />
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--theme-text-primary)' }}>Launcher Required</p>
        <p style={{ color: 'var(--theme-text-muted)' }}>Save management is only available in the desktop launcher.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status message */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Cloud saves */}
      {cloudSupported && (
        <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: 'var(--theme-item-default)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Cloud className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-text-primary)' }} />
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>Cloud Saves</p>
                <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                  {cloudStatus?.enabled
                    ? cloudStatus.syncing
                      ? 'Syncing…'
                      : cloudStatus.error
                        ? `Sync error: ${cloudStatus.error}`
                        : `Last synced ${formatRelativeTime(cloudStatus.lastSyncedAt)}`
                    : 'Automatically back up your save to Google Drive'}
                </p>
              </div>
            </div>
            <Switch
              checked={!!cloudStatus?.enabled}
              disabled={cloudBusy}
              onCheckedChange={handleToggleCloudSave}
            />
          </div>
        </div>
      )}

      {/* Backup current save */}
      <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: 'var(--theme-item-default)' }}>
        <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
          <Plus className="w-4 h-4 inline mr-1" />
          Backup Current Save
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="Save name..."
            value={newSaveName}
            onChange={(e) => setNewSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBackup()}
            className="flex-1"
            style={{ backgroundColor: 'var(--theme-input-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
            disabled={loading}
          />
          <Button onClick={handleBackup} disabled={loading || !newSaveName.trim()} className="bg-[#5c7e10] hover:bg-[#78a00f] text-white">
            <Save className="w-3 h-3 mr-1" /> Backup
          </Button>
        </div>
        <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--theme-border)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Start a fresh save</p>
          <Button size="sm" onClick={() => { setCreateName(''); setCreateOpen(true); }} disabled={loading} className="gap-1 bg-[#d97706] hover:bg-[#f59e0b] text-white border-0">
            <FilePlus className="w-3 h-3" /> Create New Save
          </Button>
        </div>
      </div>

      {/* Create-new-save dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!loading) setCreateOpen(o); }}>
        <DialogContent className="sm:max-w-md" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Create New Save</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
              Name a backup of your current save, or discard it. Either way, the live save will be cleared so the game starts fresh on the next launch.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input placeholder="Backup name..." value={createName} onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && createName.trim()) handleCreateNewSave(true); }}
              autoFocus style={{ backgroundColor: 'var(--theme-input-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }} disabled={loading} />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={loading} style={{ color: 'var(--theme-text-muted)' }}>Cancel</Button>
            <Button variant="outline" onClick={() => setConfirmDiscardOpen(true)} disabled={loading} className="gap-1 bg-[#b91c1c] hover:bg-[#dc2626] text-white border-0">
              <Trash2 className="w-3 h-3" /> Discard Save
            </Button>
            <Button onClick={() => handleCreateNewSave(true)} disabled={loading || !createName.trim()} className="bg-[#5c7e10] hover:bg-[#78a00f] text-white gap-1">
              <Save className="w-3 h-3" /> Backup &amp; Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm discard dialog */}
      <Dialog open={confirmDiscardOpen} onOpenChange={(o) => { if (!loading) setConfirmDiscardOpen(o); }}>
        <DialogContent className="sm:max-w-md" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Discard current save?</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
              This will permanently delete your current save without creating a backup. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setConfirmDiscardOpen(false)} disabled={loading} style={{ color: 'var(--theme-text-muted)' }}>Cancel</Button>
            <Button onClick={() => { setConfirmDiscardOpen(false); handleCreateNewSave(false); }} disabled={loading} className="gap-1 bg-[#b91c1c] hover:bg-[#dc2626] text-white border-0">
              <Trash2 className="w-3 h-3" /> Discard Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open folder buttons */}
      <div className="flex justify-between mb-3 gap-2">
        {(window as any).openSaveFolder && (
          <Button variant="ghost" size="sm" onClick={() => (window as any).openSaveFolder(recompName)} className="gap-1" style={{ color: 'var(--theme-text-muted)' }}>
            <FolderOpen className="w-3 h-3" /> Saves
          </Button>
        )}
        {(window as any).openBackupsFolder && (
          <Button variant="ghost" size="sm" onClick={() => (window as any).openBackupsFolder(recompName)} className="gap-1" style={{ color: 'var(--theme-text-muted)' }}>
            <FolderOpen className="w-3 h-3" /> Backups
          </Button>
        )}
      </div>

      {/* Save slots list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>Backups ({slots.length})</h3>
          <Button variant="ghost" size="icon" onClick={refreshSlots} style={{ color: 'var(--theme-text-muted)' }}><RefreshCw className="w-3 h-3" /></Button>
        </div>
        {slots.length === 0 ? (
          <p className="text-center py-6 text-sm" style={{ color: 'var(--theme-text-muted)' }}>No backups yet. Create one above.</p>
        ) : (
          <div className="space-y-1">
            {slots.map(slot => (
              <div key={slot.name} className="flex items-center gap-2 p-3 rounded-lg transition-colors"
                style={{ backgroundColor: activeSave === slot.name ? 'var(--theme-item-selected)' : 'var(--theme-item-default)', borderLeft: activeSave === slot.name ? '3px solid var(--theme-accent)' : '3px solid transparent' }}>
                {renamingSlot === slot.name ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(slot.name); if (e.key === 'Escape') setRenamingSlot(null); }}
                      className="flex-1 h-7 text-sm" style={{ backgroundColor: 'var(--theme-input-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }} autoFocus />
                    <Button size="icon" variant="ghost" onClick={() => handleRename(slot.name)} className="h-7 w-7 text-green-400"><Check className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setRenamingSlot(null)} className="h-7 w-7 text-red-400"><X className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--theme-text-primary)' }}>{slot.name}</p>
                      {activeSave === slot.name && <p className="text-xs" style={{ color: 'var(--theme-accent)' }}>Currently loaded</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white h-7 text-xs" onClick={() => handleRestore(slot.name)} disabled={loading}>
                        <Upload className="w-3 h-3 mr-1" /> Load
                      </Button>
                      <Button size="sm" className="bg-[#5c7e10] hover:bg-[#78a00f] text-white h-7 text-xs"
                        onClick={() => { const ok = (window as any).backupSave(recompName, slot.name); if (ok) { showMessage(`Overwrote "${slot.name}"`, 'success'); refreshSlots(); } else { showMessage('Overwrite failed', 'error'); } }}
                        disabled={loading}>
                        <Save className="w-3 h-3 mr-1" /> Overwrite
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setRenamingSlot(slot.name); setRenameValue(slot.name); }} disabled={loading} className="h-7 w-7" style={{ color: 'var(--theme-text-muted)' }}><Pencil className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(slot.name)} disabled={loading} className="h-7 w-7 text-red-400"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
