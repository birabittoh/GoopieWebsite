import { Check, AlertTriangle, X, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';

export interface DropItem {
  file: string;
  kind: 'base' | 'update' | 'dlc' | 'mod' | 'unknown';
  status: 'installed' | 'ignored' | 'error';
  game: string | null;
  gameTitle: string | null;
  message: string;
}

export interface DropReport {
  items: DropItem[];
  focusGame: string | null;
}

interface DropResultDialogProps {
  report: DropReport | null;
  onClose: () => void;
}

const KIND_LABEL: Record<DropItem['kind'], string> = {
  base: 'Game',
  update: 'Update',
  dlc: 'DLC',
  mod: 'Mod',
  unknown: 'File',
};

function StatusIcon({ status }: { status: DropItem['status'] }) {
  if (status === 'installed') return <Check className="w-4 h-4 shrink-0 text-green-400" />;
  if (status === 'ignored') return <HelpCircle className="w-4 h-4 shrink-0 text-yellow-400" />;
  return <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />;
}

export function DropResultDialog({ report, onClose }: DropResultDialogProps) {
  const items = report?.items ?? [];
  const installedCount = items.filter(i => i.status === 'installed').length;

  return (
    <Dialog open={!!report} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Files processed</DialogTitle>
          <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
            {installedCount} of {items.length} file{items.length === 1 ? '' : 's'} installed.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2 pr-3">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-3 rounded-lg min-w-0"
                style={{ backgroundColor: 'var(--theme-item-default)' }}
              >
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-medium break-words min-w-0" style={{ color: 'var(--theme-text-primary)' }}>
                      {item.file}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                      style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-muted)' }}
                    >
                      {KIND_LABEL[item.kind]}
                    </span>
                    {item.gameTitle && (
                      <span className="text-xs break-words min-w-0" style={{ color: 'var(--theme-text-muted)' }}>
                        → {item.gameTitle}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 break-words" style={{ color: 'var(--theme-text-muted)' }}>
                    {item.message}
                  </p>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm py-2" style={{ color: 'var(--theme-text-muted)' }}>No files were processed.</p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={onClose}>
            <X className="w-3 h-3 mr-1" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
