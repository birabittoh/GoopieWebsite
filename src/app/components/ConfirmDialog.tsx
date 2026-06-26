import type { ReactNode } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmIcon,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>{title}</DialogTitle>
          <DialogDescription style={{ color: 'var(--theme-text-muted)' }} asChild>
            <div>{description}</div>
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
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
