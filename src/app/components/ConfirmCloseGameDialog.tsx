import { X } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import type { InstalledBuild } from '../data/useGameReleases';

interface ConfirmCloseGameDialogProps {
  pendingPlayBuild: InstalledBuild | null;
  runningGame: { game: string; build: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmCloseGameDialog({
  pendingPlayBuild,
  runningGame,
  onCancel,
  onConfirm,
}: ConfirmCloseGameDialogProps) {
  return (
    <Dialog open={!!pendingPlayBuild} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Close the running game?</DialogTitle>
          <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
            {runningGame ? `${runningGame.game} is currently running. ` : ''}
            Launching this game will close it first, and any unsaved progress will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="gap-2 bg-[#8b1a1a] hover:bg-[#a52525] text-white border-0"
          >
            <X className="w-4 h-4" />
            Close & Play
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
