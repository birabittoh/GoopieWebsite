import { X } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
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
    <ConfirmDialog
      open={!!pendingPlayBuild}
      title="Close the running game?"
      description={
        <>
          {runningGame ? `${runningGame.game} is currently running. ` : ''}
          Launching this game will close it first, and any unsaved progress will be lost.
        </>
      }
      confirmLabel="Close & Play"
      confirmIcon={<X className="w-4 h-4" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
