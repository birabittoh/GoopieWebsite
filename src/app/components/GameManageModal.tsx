import { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, FolderOpen, Download, RefreshCw, Check, X, AlertTriangle, Plus, Link } from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import type { Game } from '../types/game';
import { SaveManagerPanel } from './SaveManagerPanel';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

interface InstalledDlc {
  hash: string;
  title_id: string;
  name: string;
}

interface GameManageModalProps {
  game: Game;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onSaveGame?: (game: Game) => void;
  onCreateShortcut?: () => void;
}

export function GameManageModal({ game, open, onClose, canEdit, onSaveGame, onCreateShortcut }: GameManageModalProps) {
  const [updateInstalled, setUpdateInstalled] = useState(false);
  const [installedDlc, setInstalledDlc] = useState<InstalledDlc[]>([]);
  const [shortcutCreated, setShortcutCreated] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; label: string; onConfirm: () => void } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStatus = game.updateStatus || 'hidden';
  const dlcNames = game.dlcNames || [];
  const showAssetsTab = isLauncherVersionAtLeast('1.4.0');
  const supportsMountToggle = isLauncherVersionAtLeast('1.4.1');
  const showSavesTab = !game.disableSaveManager;
  const showShortcutRow = isLauncherVersionAtLeast('1.5.0') && !!onCreateShortcut;
  const useTabs = showAssetsTab && showSavesTab;

  const refresh = useCallback(() => {
    const w = window as any;
    if (w.isUpdateInstalled) setUpdateInstalled(w.isUpdateInstalled(game.recompName));
    if (w.getInstalledDlc) {
      const dlc = w.getInstalledDlc(game.recompName);
      setInstalledDlc(Array.isArray(dlc) ? dlc : (typeof dlc === 'string' ? JSON.parse(dlc) : []));
    }
    if (w.isExtracting) setExtracting(w.isExtracting());
    if (w.getExtractError) {
      const err = w.getExtractError();
      if (err) setExtractError(err);
    }
    if (w.shortcutExists) setShortcutCreated(!!w.shortcutExists(game.recompName, game.title));
  }, [game.recompName, game.title]);

  useEffect(() => {
    if (!open) return;
    refresh();
    pollRef.current = setInterval(refresh, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, refresh]);

  const allowUpdate = updateStatus !== 'hidden' || updateInstalled;

  const handleInstallAssetPick = useCallback(() => {
    const w = window as any;
    if (w.InstallAssetPick) {
      w.InstallAssetPick(game.recompName, game.updateChecksum || '', dlcNames, true, allowUpdate);
      setExtracting(true);
    }
  }, [game.recompName, game.updateChecksum, dlcNames, allowUpdate]);

  const handleFileDrop = useCallback((paths: string[]) => {
    const w = window as any;
    if (w.InstallAssetFiles && paths.length > 0) {
      w.InstallAssetFiles(game.recompName, paths, game.updateChecksum || '', dlcNames, allowUpdate);
      setExtracting(true);
    }
  }, [game.recompName, game.updateChecksum, dlcNames, allowUpdate]);

  useEffect(() => {
    if (!open || !showAssetsTab) return;
    const onFileDrop = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.paths) handleFileDrop(detail.paths);
    };
    window.addEventListener('goopie:filedrop', onFileDrop);
    return () => window.removeEventListener('goopie:filedrop', onFileDrop);
  }, [open, showAssetsTab, handleFileDrop]);

  const handleRemoveUpdate = useCallback(() => {
    setConfirmAction({
      type: 'remove-update',
      label: 'Remove the installed title update?',
      onConfirm: () => {
        const w = window as any;
        if (w.RemoveUpdate) w.RemoveUpdate(game.recompName);
        setConfirmAction(null);
        setTimeout(refresh, 200);
      },
    });
  }, [game.recompName, refresh]);

  const handleRemoveDlc = useCallback((dlc: InstalledDlc) => {
    setConfirmAction({
      type: 'remove-dlc',
      label: `Remove DLC "${dlc.name || dlc.hash}"?`,
      onConfirm: () => {
        const w = window as any;
        if (w.RemoveDlc) w.RemoveDlc(game.recompName, dlc.title_id, dlc.hash);
        setConfirmAction(null);
        setTimeout(refresh, 200);
      },
    });
  }, [game.recompName, refresh]);

  const matchDlcName = (installed: InstalledDlc): string | null => {
    return dlcNames.find(n => n.trim().toLowerCase() === installed.name.trim().toLowerCase()) || null;
  };

  const handleAddKnownDlc = useCallback((name: string) => {
    if (!onSaveGame || !name.trim()) return;
    const updated = { ...game, dlcNames: [...(game.dlcNames || []), name.trim()] };
    onSaveGame(updated);
  }, [game, onSaveGame]);

  const assetsPanel = showAssetsTab && (
    <div className="space-y-4">
      {extracting && (
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--theme-accent)' }} />
          <span className="text-sm font-medium shrink-0" style={{ color: 'var(--theme-text-primary)' }}>Extracting...</span>
        </div>
      )}
      {extractError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {extractError}
          <button onClick={() => { setExtractError(null); const w = window as any; if (w.clearExtractError) w.clearExtractError(); }} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Update row — show when not hidden, or when hidden but already installed */}
      {(updateStatus !== 'hidden' || updateInstalled) && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>Title Update</p>
              {game.updateChecksum && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                  SHA-256: {game.updateChecksum.slice(0, 16)}...
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {updateInstalled ? (
                <>
                  <span className="text-xs flex items-center gap-1 text-green-400"><Check className="w-3 h-3" /> Installed</span>
                  <Button size="sm" variant="ghost" onClick={() => { const w = window as any; if (w.openUpdateFolder) w.openUpdateFolder(game.recompName); }} title="Open folder"><FolderOpen className="w-4 h-4" /></Button>
                  <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={handleRemoveUpdate}><Trash2 className="w-3 h-3" /></Button>
                </>
              ) : (
                <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleInstallAssetPick} disabled={extracting}>
                  <Download className="w-3 h-3 mr-1" /> Browse...
                </Button>
              )}
            </div>
          </div>
          {updateInstalled && onSaveGame && supportsMountToggle && (
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={game.mountUpdate !== false}
                  onChange={e => onSaveGame({ ...game, mountUpdate: e.target.checked ? undefined : false })}
                />
                <div className="w-9 h-5 peer-checked:bg-[#5c7e10] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" style={{ backgroundColor: game.mountUpdate === false ? 'var(--theme-item-selected)' : undefined }}></div>
              </div>
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Mount at launch</span>
            </label>
          )}
        </div>
      )}

      {/* Shortcut row */}
      {showShortcutRow && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>Shortcut</p>
            </div>
            <div className="flex items-center gap-2">
              {shortcutCreated ? (
                <span className="text-xs flex items-center gap-1 text-green-400"><Check className="w-3 h-3" /> Created.</span>
              ) : (
                <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={() => { onCreateShortcut(); setTimeout(refresh, 500); }}>
                  <Link className="w-3 h-3 mr-1" /> Create
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DLC section — always shown in the assets panel */}
      <div>
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--theme-text-primary)' }}>DLC</p>
        <div className="space-y-2">
          {/* Known DLC names from game config */}
          {dlcNames.map((name, i) => {
            const installed = installedDlc.find(d => matchDlcName(d) === name);
            return (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
                <p className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>{name}</p>
                <div className="flex items-center gap-2">
                  {installed ? (
                    <>
                      <span className="text-xs flex items-center gap-1 text-green-400"><Check className="w-3 h-3" /> Installed</span>
                      <Button size="sm" variant="ghost" onClick={() => { const w = window as any; if (w.openDlcFolder) w.openDlcFolder(game.recompName, installed.title_id, installed.hash); }} title="Open folder"><FolderOpen className="w-3 h-3" /></Button>
                      <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => handleRemoveDlc(installed)}><Trash2 className="w-3 h-3" /></Button>
                    </>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Not installed</span>
                  )}
                </div>
              </div>
            );
          })}
          {/* Unknown installed DLC (not in dlcNames) */}
          {installedDlc.filter(d => !matchDlcName(d)).map(dlc => (
            <div key={dlc.hash} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
              <p className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>{dlc.name || dlc.hash}</p>
              <div className="flex items-center gap-2">
                {canEdit && onSaveGame && dlc.name ? (
                  <button
                    onClick={() => handleAddKnownDlc(dlc.name)}
                    className="text-xs flex items-center gap-1 text-yellow-400 hover:text-green-400 transition-colors group cursor-pointer"
                    title="Add as known DLC"
                  >
                    <AlertTriangle className="w-3 h-3 group-hover:hidden" />
                    <Plus className="w-3 h-3 hidden group-hover:block" />
                    <span className="group-hover:hidden">Unknown</span>
                    <span className="hidden group-hover:inline">Add to known</span>
                  </button>
                ) : (
                  <span className="text-xs flex items-center gap-1 text-yellow-400"><AlertTriangle className="w-3 h-3" /> Unknown</span>
                )}
                <Button size="sm" variant="ghost" onClick={() => { const w = window as any; if (w.openDlcFolder) w.openDlcFolder(game.recompName, dlc.title_id, dlc.hash); }} title="Open folder"><FolderOpen className="w-3 h-3" /></Button>
                <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => handleRemoveDlc(dlc)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          {dlcNames.length === 0 && installedDlc.length === 0 && (
            <p className="text-xs py-2" style={{ color: 'var(--theme-text-muted)' }}>No DLC installed.</p>
          )}
        </div>
        <Button size="sm" className="mt-3 bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={handleInstallAssetPick} disabled={extracting}>
          <Download className="w-3 h-3 mr-1" /> Add...
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent
          className="sm:max-w-lg max-h-[80vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>
              Manage — {game.title}
            </DialogTitle>
          </DialogHeader>

          {useTabs ? (
            <Tabs defaultValue="assets">
              <TabsList style={{ backgroundColor: 'var(--theme-item-default)' }}>
                <TabsTrigger value="assets" className="data-[state=active]:bg-[var(--theme-item-selected)] text-[var(--theme-text-muted)] data-[state=active]:text-[var(--theme-text-primary)]">Assets</TabsTrigger>
                <TabsTrigger value="saves" className="data-[state=active]:bg-[var(--theme-item-selected)] text-[var(--theme-text-muted)] data-[state=active]:text-[var(--theme-text-primary)]">Saves</TabsTrigger>
              </TabsList>
              <TabsContent value="assets">{assetsPanel}</TabsContent>
              <TabsContent value="saves">
                <SaveManagerPanel recompName={game.recompName} />
              </TabsContent>
            </Tabs>
          ) : showAssetsTab ? (
            assetsPanel
          ) : showSavesTab ? (
            <SaveManagerPanel recompName={game.recompName} />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        title="Confirm"
        description={confirmAction?.label ?? ''}
        confirmLabel="Remove"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
      />
    </>
  );
}
