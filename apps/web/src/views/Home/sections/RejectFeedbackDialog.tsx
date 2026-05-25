// lint-allow-ui-copy: V5 D.4.1 Section C reject-feedback dialog copy.
import { useState } from 'react';
import { useRejectRecommendation } from '@sikao/api-client/recommendationsQueries';
import { useRecommendationDraftStore } from '@sikao/domain';
import type { RecommendationReadV2 } from '@sikao/api-client/types/home';
import { Modal } from '../../../components/overlay/Modal';
import { Textarea } from '../../../components/form';

/*
 * RejectFeedbackDialog — SIK-92 wave 2.
 *
 * Why: replaces the wave 1 stub reject (fixed reason=not-interested).
 *      Lets the user pick a reason + add an optional note. Draft is
 *      mirrored into useRecommendationDraftStore so closing/cancelling
 *      restores the draft on next open (per spec acceptance).
 *
 *      AGENT-H7: reason field is mandatory; submit disabled until non-
 *      empty. Mutation errors surface via the mutation result.
 */

const REASONS: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: 'not-interested', label: '不感兴趣' },
  { value: 'too-easy', label: '太简单' },
  { value: 'too-hard', label: '太难' },
  { value: 'wrong-time', label: '时间不合适' },
  { value: 'other', label: '其它' },
];

interface RejectFeedbackDialogProps {
  readonly recommendation: RecommendationReadV2;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function RejectFeedbackDialog({ recommendation, open, onClose }: RejectFeedbackDialogProps) {
  const rejectMutation = useRejectRecommendation(recommendation.id);
  const setDraft = useRecommendationDraftStore((s) => s.setDraft);
  const clearDraft = useRecommendationDraftStore((s) => s.clearDraft);
  const getDraft = useRecommendationDraftStore((s) => s.getDraft);
  // Lazy-init from the saved draft so we don't need a setState-in-effect
  // hydrate (which trips eslint react-hooks). The dialog re-mounts when
  // `open` flips false→true (RecommendationCard remounts the dialog
  // after close), so this also picks up store changes naturally.
  const initialDraft = getDraft(recommendation.id);
  const [reason, setReason] = useState<string>(initialDraft?.reason ?? '');
  const [note, setNote] = useState<string>(initialDraft?.note ?? '');

  // Mirror form state into the draft store on every change so cancel
  // → reopen restores the user's last input. Direct call (no effect)
  // because the store write is debounced internally and avoids a
  // setState-in-effect cascade.
  const handleReasonChange = (next: string) => {
    setReason(next);
    if (next.length > 0) {
      setDraft(recommendation.id, { reason: next, note: note.length > 0 ? note : null });
    }
  };

  const handleNoteChange = (next: string) => {
    setNote(next);
    if (reason.length > 0) {
      setDraft(recommendation.id, { reason, note: next.length > 0 ? next : null });
    }
  };

  const isValid = reason.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    rejectMutation.mutate(
      { reason, note: note.length > 0 ? note : null },
      {
        onSuccess: () => {
          clearDraft(recommendation.id);
          setReason('');
          setNote('');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="为什么不感兴趣？"
      description={recommendation.title}
      primaryAction={{
        label: rejectMutation.isPending ? '提交中…' : '提交反馈',
        onClick: handleSubmit,
        variant: 'primary',
      }}
      secondaryAction={{ label: '取消', onClick: onClose }}
    >
      <div data-testid="reject-feedback" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <legend style={{ fontSize: 'var(--font-meta)', color: 'var(--color-text-secondary)' }}>原因</legend>
          {REASONS.map((r) => (
            <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                type="radio"
                name="reject-reason"
                value={r.value}
                aria-label={r.label}
                checked={reason === r.value}
                onChange={() => handleReasonChange(r.value)}
                data-testid={`reject-reason-${r.value}`}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </fieldset>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <span style={{ fontSize: 'var(--font-meta)', color: 'var(--color-text-secondary)' }}>补充说明（可选）</span>
          <Textarea
            value={note}
            onChange={(v) => handleNoteChange(v)}
            data-testid="reject-note"
            rows={3}
          />
        </label>
      </div>
    </Modal>
  );
}
