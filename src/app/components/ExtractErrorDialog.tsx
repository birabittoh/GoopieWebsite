import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

interface ExtractErrorDialogProps {
  error: string | null;
  onClose: () => void;
}

export function ExtractErrorDialog({ error, onClose }: ExtractErrorDialogProps) {
  return (
    <Dialog open={!!error} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Extraction failed</DialogTitle>
          <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
            Something went wrong while extracting the game files. Please make sure the file is a valid game ISO or XBLA package and try again.
          </DialogDescription>
        </DialogHeader>
        <pre
          className="text-xs p-3 rounded overflow-x-auto whitespace-pre-wrap break-words"
          style={{ backgroundColor: 'var(--theme-page-bg)', color: 'var(--theme-text-muted)', border: '1px solid var(--theme-border)' }}
        >
          {error}
        </pre>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
