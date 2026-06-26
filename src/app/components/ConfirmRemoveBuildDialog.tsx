import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface ConfirmRemoveBuildDialogProps {
  build: { name: string; version?: string; asset?: string } | null;
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
    <ConfirmDialog
      open={!!build}
      title="Remove this build?"
      description={<>Are you sure you want to remove <strong>{label}</strong>? This cannot be undone.</>}
      confirmLabel="Remove"
      confirmIcon={<Trash2 className="w-4 h-4" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
