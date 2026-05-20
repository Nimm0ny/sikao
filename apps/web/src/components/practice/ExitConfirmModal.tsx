import { Button, Modal } from '@sikao/ui/ui';
import { PRACTICE_COPY } from '@/lib/ui-copy';

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
      title={`${PRACTICE_COPY.exitTitle}？`}
      description={`${PRACTICE_COPY.exitDescPart1}，${PRACTICE_COPY.exitDescPart2}。${PRACTICE_COPY.exitDescPart3}，${PRACTICE_COPY.exitDescPart4}。`}
      ariaLabel={PRACTICE_COPY.exitAriaLabel}
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
