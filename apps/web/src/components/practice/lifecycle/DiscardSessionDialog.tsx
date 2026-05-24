import { ConfirmDialog } from '../../overlay';

export interface DiscardSessionDialogProps {
  readonly open: boolean;
  readonly loading?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void | Promise<void>;
}

export function DiscardSessionDialog({
  open,
  loading = false,
  onClose,
  onConfirm,
}: DiscardSessionDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      loading={loading}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Discard session?"
      description="Discarding this session stops the current runtime and marks it abandoned."
      confirmText="Discard"
      destructive
    />
  );
}
