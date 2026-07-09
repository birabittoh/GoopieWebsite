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
import { AchievementsPanel } from './AchievementsPanel';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';

interface InstalledDlc {
  hash: string;
  title_id: string;
  name: string;
}

// Remembered in-memory only (not persisted) — resets on launcher restart.
let lastManageTab: string | null = null;

interface GameManageModalProps {
  game: Game;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onSaveGame?: (game: Game) => void;
}

export function GameManageModal({ game, open, onClose, canEdit, onSaveGame }: GameManageModalProps) {
  const [updateInstalled, setUpdateInstalled] = useState(false);
  const [installedDlc, setInstalledDlc] = useState<InstalledDlc[]>([]);
  const [desktopShortcutCreated, setDesktopShortcutCreated] = useState(false);
  const [appShortcutCreated, setAppShortcutCreated] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; label: string; onConfirm: () => void } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStatus = game.updateStatus || 'hidden';
  const dlcNames = game.dlcNames || [];
  const showAssetsTab = isLauncherVersionAtLeast('1.4.0');
  const showSavesTab = !game.disableSaveManager;
  const showShortcutRow = isLauncherVersionAtLeast('1.5.3');
  const showAchievementsTab =
    isLauncherVersionAtLeast('1.5.2') &&
    !!game.achievementsEnabled &&
    typeof (window as any).getAchievements === 'function';
  const visiblePanelCount = [showAssetsTab, showSavesTab, showAchievementsTab].filter(Boolean).length;
  const useTabs = visiblePanelCount > 1;

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
    if (w.desktopShortcutExists) setDesktopShortcutCreated(!!w.desktopShortcutExists(game.recompName, game.title));
    if (w.appShortcutExists) setAppShortcutCreated(!!w.appShortcutExists(game.recompName, game.title));
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
      w.InstallAssetPick(game.recompName, game.updateChecksum || '', dlcNames, true, allowUpdate, game.xexSha256 || '');
      setExtracting(true);
    }
  }, [game.recompName, game.updateChecksum, game.xexSha256, dlcNames, allowUpdate]);

  const handleFileDrop = useCallback((paths: string[]) => {
    const w = window as any;
    if (w.InstallAssetFiles && paths.length > 0) {
      w.InstallAssetFiles(game.recompName, paths, game.updateChecksum || '', dlcNames, allowUpdate, game.xexSha256 || '');
      setExtracting(true);
    }
  }, [game.recompName, game.updateChecksum, game.xexSha256, dlcNames, allowUpdate]);

  useEffect(() => {
    // 1.6.0+ launchers handle every drop globally via FileDropManager
    // (any screen, whole-catalogue matching) — this modal-local listener is
    // only needed as a fallback for older launchers that lack `ProcessDrops`.
    if (!open || !showAssetsTab || isLauncherVersionAtLeast('1.6.0')) return;
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

      {/* Shortcut row */}
      {showShortcutRow && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--theme-item-default)' }}>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>Shortcuts</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Desktop</span>
                {desktopShortcutCreated ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" />
                    <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => { const w = window as any; if (w.RemoveDesktopShortcut) w.RemoveDesktopShortcut(game.recompName, game.title); setTimeout(refresh, 500); }}><Trash2 className="w-3 h-3" /></Button>
                  </>
                ) : (
                  <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={() => { const w = window as any; if (w.CreateDesktopShortcut) w.CreateDesktopShortcut(game.recompName, game.title, game.iconUrl || ''); setTimeout(refresh, 500); }}><Link className="w-3 h-3" /></Button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Applications</span>
                {appShortcutCreated ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" />
                    <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52525] text-white" onClick={() => { const w = window as any; if (w.RemoveAppShortcut) w.RemoveAppShortcut(game.recompName, game.title); setTimeout(refresh, 500); }}><Trash2 className="w-3 h-3" /></Button>
                  </>
                ) : (
                  <Button size="sm" className="bg-[#1a6bc4] hover:bg-[#2080e0] text-white" onClick={() => { const w = window as any; if (w.CreateAppShortcut) w.CreateAppShortcut(game.recompName, game.title, game.iconUrl || ''); setTimeout(refresh, 500); }}><Link className="w-3 h-3" /></Button>
                )}
              </div>
            </div>
          </div>
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
          className="sm:max-w-lg max-h-[80vh] overflow-y-auto overflow-x-hidden"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>
              Manage — {game.title}
            </DialogTitle>
          </DialogHeader>

          {useTabs ? (
            <Tabs
              className="min-w-0"
              defaultValue={
                (lastManageTab === 'assets' && showAssetsTab) ||
                (lastManageTab === 'saves' && showSavesTab) ||
                (lastManageTab === 'achievements' && showAchievementsTab)
                  ? lastManageTab
                  : showAssetsTab ? 'assets' : showSavesTab ? 'saves' : 'achievements'
              }
              onValueChange={v => { lastManageTab = v; }}
            >
              <TabsList style={{ backgroundColor: 'var(--theme-item-default)' }}>
                {showAssetsTab && (
                  <TabsTrigger value="assets" className="data-[state=active]:bg-[var(--theme-item-selected)] text-[var(--theme-text-muted)] data-[state=active]:text-[var(--theme-text-primary)]">Assets</TabsTrigger>
                )}
                {showSavesTab && (
                  <TabsTrigger value="saves" className="data-[state=active]:bg-[var(--theme-item-selected)] text-[var(--theme-text-muted)] data-[state=active]:text-[var(--theme-text-primary)]">Saves</TabsTrigger>
                )}
                {showAchievementsTab && (
                  <TabsTrigger value="achievements" className="data-[state=active]:bg-[var(--theme-item-selected)] text-[var(--theme-text-muted)] data-[state=active]:text-[var(--theme-text-primary)]">Achievements</TabsTrigger>
                )}
              </TabsList>
              {showAssetsTab && <TabsContent value="assets">{assetsPanel}</TabsContent>}
              {showSavesTab && (
                <TabsContent value="saves">
                  <SaveManagerPanel recompName={game.recompName} />
                </TabsContent>
              )}
              {showAchievementsTab && (
                <TabsContent value="achievements">
                  <AchievementsPanel recompName={game.recompName} />
                </TabsContent>
              )}
            </Tabs>
          ) : showAssetsTab ? (
            assetsPanel
          ) : showSavesTab ? (
            <SaveManagerPanel recompName={game.recompName} />
          ) : showAchievementsTab ? (
            <AchievementsPanel recompName={game.recompName} />
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
