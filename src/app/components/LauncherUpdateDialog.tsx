import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { useLauncherUpdate } from '../data/LauncherUpdateContext';
import { isLauncherVersionAtLeast } from '../utils/launcherVersion';
import { openExternal } from '../utils/externalLink';

interface LauncherUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation + progress dialog for the launcher self-update flow, opened
 * from the "update available" icon in the TopBar.
 *
 * The launcher never updates itself silently — this is the only place that
 * triggers `SelfUpdateLauncher`, and only after the user explicitly says yes.
 * Once the download finishes, the native side replaces the running
 * executable/AppImage and restarts the app on its own; there's nothing left
 * for the page to do but show progress until that happens.
 */
export function LauncherUpdateDialog({ open, onOpenChange }: LauncherUpdateDialogProps) {
  const { latestVersion, updating, downloadProgress, downloadString, startSelfUpdate } = useLauncherUpdate();

  return (
    // While updating, ignore close attempts (Escape / overlay click / the X
    // button all funnel through onOpenChange) — the dialog stays put until the
    // download finishes and the launcher restarts itself.
    <Dialog open={open} onOpenChange={(next) => { if (!updating) onOpenChange(next); }}>
      <DialogContent
        showCloseButton={false}
        style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
      >
        {updating ? (
          <>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Updating launcher…</DialogTitle>
              <DialogDescription style={{ color: 'var(--theme-text-secondary)' }}>
                Downloading the new version. The launcher will restart automatically once it's ready — please don't close it.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--theme-text-primary)' }} />
              <Progress value={Math.max(downloadProgress, 0)} className="flex-1" />
            </div>
            <p className="text-sm text-right" style={{ color: 'var(--theme-text-secondary)' }}>
              {downloadProgress > 0 ? `${downloadProgress}%` : ''}{downloadString ? ` · ${downloadString}` : ''}
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Update available</DialogTitle>
              <DialogDescription style={{ color: 'var(--theme-text-secondary)' }}>
                A new launcher version{latestVersion ? ` (${latestVersion})` : ''} is available. Download and install it now? The launcher will restart automatically once the update is applied.
              </DialogDescription>
            </DialogHeader>
            {!isLauncherVersionAtLeast('1.7.0') && (
              <p className="text-sm rounded-md border p-3" style={{ borderColor: '#f59e0b', color: 'var(--theme-text-primary)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                Your launcher version is too old for the self-update process — it will probably fail. You can still try, but if it
                doesn't work, download the latest version manually from{' '}
                <a
                  href="https://goopie.xyz/#/downloads"
                  onClick={e => { e.preventDefault(); openExternal('https://goopie.xyz/#/downloads'); }}
                  className="underline cursor-pointer"
                >
                  goopie.xyz/#/downloads
                </a>.
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  variant="outline"
                  style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', backgroundColor: 'transparent' }}
                >
                  No
                </Button>
              </DialogClose>
              <Button onClick={startSelfUpdate}>Yes, update now</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
