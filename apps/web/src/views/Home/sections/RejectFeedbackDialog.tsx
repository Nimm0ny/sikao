// lint-allow-ui-copy: V5 D.4.1 Section C reject-feedback dialog copy.
import { useState } from 'react';
import { useRejectRecommendation } from '@sikao/api-client/recommendationsQueries';
import { useRecommendationDraftStore } from '@sikao/domain';
import type { RecommendationReadV2 } from '@sikao/api-client/types/home';
import { Modal } from '../../../components/overlay/Modal';
import { Textarea } from '../../../components/form';

/*
 * RejectFeedbackDialog — SIK-92 closeout.
 *
 * Why: reject is reason-first, but draft restore must preserve note-only
 *      input across close/reopen. Draft state is mirrored on every edit,
 *      and invalid submit surfaces an inline error instead of silently
 *      returning.
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
  readonly initialDraft: { readonly reason: string; readonly note: string | null } | null;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function RejectFeedbackDialog({ recommendation, initialDraft, open, onClose }: RejectFeedbackDialogProps) {
  const rejectMutation = useRejectRecommendation(recommendation.id);
  const setDraft = useRecommendationDraftStore((s) => s.setDraft);
  const clearDraft = useRecommendationDraftStore((s) => s.clearDraft);
  const [reason, setReason] = useState<string>(initialDraft?.reason ?? '');
  const [note, setNote] = useState<string>(initialDraft?.note ?? '');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const persistDraft = (nextReason: string, nextNote: string) => {
    setDraft(recommendation.id, {
      reason: nextReason,
      note: nextNote.trim().length > 0 ? nextNote : null,
    });
  };

  const handleReasonChange = (next: string) => {
    setReason(next);
    setSubmitError(null);
    persistDraft(next, note);
  };

  const handleNoteChange = (next: string) => {
    setNote(next);
    persistDraft(reason, next);
  };

  const handleSubmit = () => {
    if (reason.length === 0) {
      setSubmitError('请选择原因后再提交反馈。');
      return;
    }
    const trimmedNote = note.trim();
    rejectMutation.mutate(
      { reason, note: trimmedNote.length > 0 ? trimmedNote : null },
      {
        onSuccess: () => {
          clearDraft(recommendation.id);
          setReason('');
          setNote('');
          setSubmitError(null);
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
            onChange={(value) => handleNoteChange(value)}
            rows={3}
          />
        </label>
        {submitError !== null ? (
          <p role="alert" style={{ margin: 0, color: 'var(--color-state-err)', fontSize: 'var(--font-meta)' }}>
            {submitError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
