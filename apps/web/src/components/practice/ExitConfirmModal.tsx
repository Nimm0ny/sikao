import { Button, Modal } from '@sikao/ui/ui';

// Replacement for `window.confirm('确定要终止...')`. The original was forbidden
// by frontend/CLAUDE.md §3.3 (alert/confirm/prompt are not allowed in business
// code) and tracked by the TODO comment phase 3.2 cleared up.

export interface ExitConfirmModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function ExitConfirmModal({ open, onClose, onConfirm }: ExitConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="终止本次答题？"
      description="当前进度将丢失，且无法恢复。如果只是想稍后回来，可以保留页面而不终止。"
      ariaLabel="终止答题确认"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-testid="exit-cancel">
            继续答题
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            data-testid="exit-confirm"
          >
            确认终止
          </Button>
        </>
      }
    />
  );
}
