import { Trash2 } from 'lucide-react';
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

interface ConfirmRemoveBuildDialogProps {
  build: InstalledBuild | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmRemoveBuildDialog({
  build,
  onCancel,
  onConfirm,
}: ConfirmRemoveBuildDialogProps) {
  const label = build ? (build.version || build.name) + (build.asset ? ` · ${build.asset}` : '') : '';
  return (
    <Dialog open={!!build} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Remove this build?</DialogTitle>
          <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
            Are you sure you want to remove <strong>{label}</strong>? This cannot be undone.
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
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
