import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Card } from '@sikao/ui/ui';
import {
  useAcceptRecommendation,
  useRejectRecommendation,
} from '@sikao/api-client/recommendationsQueries';
import type {
  RecommendationReadV2,
  RecommendationRejectRequestV2,
} from '@sikao/api-client/types/home';
import { useRecommendationDraftStore } from '@sikao/domain/dashboard/useRecommendationDraftStore';

import { AcceptOptionMenu } from './AcceptOptionMenu';
import { RejectFeedbackDialog } from './RejectFeedbackDialog';
import {
  asRecommendationActionType,
  recommendationLabel,
  recommendationTone,
} from './recommendRuntime';

interface RecommendationCardProps {
  readonly recommendation: RecommendationReadV2;
}

export function RecommendationCard({
  recommendation,
}: RecommendationCardProps) {
  const navigate = useNavigate();
  const actionType = asRecommendationActionType(recommendation.actionType);
  const acceptMutation = useAcceptRecommendation(recommendation.id);
  const rejectMutation = useRejectRecommendation(recommendation.id);
  const hydrateDrafts = useRecommendationDraftStore((state) => state.hydrate);
  const getDraft = useRecommendationDraftStore((state) => state.getDraft);
  const setDraft = useRecommendationDraftStore((state) => state.setDraft);
  const clearDraft = useRecommendationDraftStore((state) => state.clearDraft);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [surfaceMessage, setSurfaceMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrateDrafts();
  }, [hydrateDrafts]);

  const draft = getDraft(recommendation.id);

  async function acceptSession(): Promise<void> {
    setSurfaceError(null);
    setSurfaceMessage(null);
    const response = await acceptMutation.mutateAsync({ action: 'session' });
    if (response.redirectUrl) {
      navigate(response.redirectUrl);
      return;
    }
    if (response.sessionId != null) {
      navigate(`/practice/sessions/${response.sessionId}`);
      return;
    }
    throw new Error('Session accept completed without redirect target');
  }

  async function acceptPlan(targetDate: string): Promise<void> {
    setSurfaceError(null);
    setSurfaceMessage(null);
    const response = await acceptMutation.mutateAsync({
      action: 'plan',
      targetDate,
    });
    if (response.status !== 'accepted_plan') {
      throw new Error(`Unexpected accept(plan) status: ${response.status}`);
    }
    setSurfaceMessage(`已加入 ${targetDate} 的计划。`);
  }

  async function submitReject(nextDraft: RecommendationRejectRequestV2): Promise<void> {
    setSurfaceError(null);
    setSurfaceMessage(null);
    await rejectMutation.mutateAsync(nextDraft);
    clearDraft(recommendation.id);
    setRejectOpen(false);
    setSurfaceMessage('这条推荐已被拒绝并记录反馈。');
  }

  return (
    <Card
      padding="md"
      className="space-y-4 border-line bg-surface"
          data-testid={`recommendation-card-${recommendation.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
            今日推荐
          </div>
          <div className="mt-1 font-serif text-xl text-ink">{recommendation.title}</div>
          <div className="mt-2 text-sm text-ink-3">{recommendation.reason}</div>
        </div>
        <span
          className={`inline-flex rounded-pill border px-3 py-1 text-xs font-medium ${recommendationTone(actionType)}`}
        >
          {recommendationLabel(actionType)}
        </span>
      </div>

      <div className="text-sm text-ink-3">
        预计 {recommendation.estimatedMinutes} 分钟 · 截止 {recommendation.expiresAt.slice(5, 16).replace('T', ' ')}
      </div>

      {surfaceError ? (
        <div className="rounded-card border border-err bg-err-bg p-3 text-sm text-err">
          {surfaceError}
        </div>
      ) : null}
      {surfaceMessage ? (
        <div className="rounded-card border border-ok bg-ok-bg p-3 text-sm text-ok">
          {surfaceMessage}
        </div>
      ) : null}

      <AcceptOptionMenu
        recommendation={recommendation}
        isSubmitting={acceptMutation.isPending}
        onAcceptSession={async () => {
          try {
            await acceptSession();
          } catch (error) {
            setSurfaceError(error instanceof Error ? error.message : String(error));
          }
        }}
        onAcceptPlan={async (targetDate) => {
          try {
            await acceptPlan(targetDate);
          } catch (error) {
            setSurfaceError(error instanceof Error ? error.message : String(error));
            throw error;
          }
        }}
      />

      <div className="flex justify-end">
        <Button
          variant="quiet"
          onClick={() => setRejectOpen(true)}
          disabled={acceptMutation.isPending || rejectMutation.isPending}
        >
          不合适，给反馈
        </Button>
      </div>

      {rejectOpen ? (
        <RejectFeedbackDialog
          key={`${recommendation.id}:${draft?.reason ?? 'empty'}:${draft?.note ?? ''}`}
          open
          draft={draft}
          isSubmitting={rejectMutation.isPending}
          onClose={() => setRejectOpen(false)}
          onDraftChange={(nextDraft) => setDraft(recommendation.id, nextDraft)}
          onSubmit={async (nextDraft) => {
            try {
              await submitReject(nextDraft);
            } catch (error) {
              setSurfaceError(error instanceof Error ? error.message : String(error));
            }
          }}
        />
      ) : null}
    </Card>
  );
}
