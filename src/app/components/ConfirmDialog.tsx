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
  confirmClassName?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Optional third action rendered between Cancel and Confirm. */
  extraLabel?: string;
  extraIcon?: ReactNode;
  extraClassName?: string;
  onExtra?: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmIcon,
  confirmClassName,
  onCancel,
  onConfirm,
  extraLabel,
  extraIcon,
  extraClassName,
  onExtra,
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
            className="hover:bg-[var(--theme-item-selected)]"
            onClick={onCancel}
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Cancel
          </Button>
          {extraLabel && onExtra && (
            <Button
              onClick={onExtra}
              className={extraClassName ?? "gap-2 border-0"}
              style={extraClassName ? undefined : { backgroundColor: 'var(--theme-accent)', color: 'white' }}
            >
              {extraIcon}
              {extraLabel}
            </Button>
          )}
          <Button
            onClick={onConfirm}
            className={confirmClassName ?? "gap-2 bg-[#8b1a1a] hover:bg-[#a52525] text-white border-0"}
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
