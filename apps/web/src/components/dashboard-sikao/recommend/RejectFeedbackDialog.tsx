import { useState } from 'react';

import { Button, Modal, Radio } from '@sikao/ui/ui';
import type { RecommendationRejectRequestV2 } from '@sikao/api-client/types/home';

const REASONS = [
  { value: 'too-hard', label: '当前建议过重' },
  { value: 'wrong-focus', label: '建议焦点不对' },
  { value: 'already-done', label: '这部分已经做过' },
  { value: 'not-now', label: '今天不适合这类任务' },
] as const;

interface RejectFeedbackDialogProps {
  readonly open: boolean;
  readonly draft: RecommendationRejectRequestV2 | null;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onDraftChange: (draft: RecommendationRejectRequestV2) => void;
  readonly onSubmit: (draft: RecommendationRejectRequestV2) => Promise<void>;
}

export function RejectFeedbackDialog({
  open,
  draft,
  isSubmitting,
  onClose,
  onDraftChange,
  onSubmit,
}: RejectFeedbackDialogProps) {
  const [reason, setReason] = useState(draft?.reason ?? REASONS[0].value);
  const [note, setNote] = useState(draft?.note ?? '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="拒绝这条推荐"
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button variant="quiet" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="danger"
            isLoading={isSubmitting}
            onClick={() => onSubmit({ reason, note: note.trim() || undefined })}
          >
            提交反馈
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {REASONS.map((item) => (
            <Radio
              key={item.value}
              name="recommendation-reject-reason"
              value={item.value}
              checked={reason === item.value}
              label={item.label}
              onChange={() => {
                setReason(item.value);
                onDraftChange({ reason: item.value, note });
              }}
            />
          ))}
        </div>
        <div>
          <label
            htmlFor="recommendation-reject-note"
            className="mb-2 block text-sm font-medium text-ink"
          >
            备注（可选）
          </label>
          <textarea
            id="recommendation-reject-note"
            aria-label="备注（可选）"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              onDraftChange({ reason, note: event.target.value });
            }}
            className="min-h-24 w-full rounded-card border border-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>
    </Modal>
  );
}
