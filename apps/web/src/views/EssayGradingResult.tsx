// lint-allow-ui-copy: SIK-28 grading-runtime copy remains inline until the
// shared Practice ui-copy namespace lands.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banner } from '../components/overlay';
import { EmptyState, Skeleton } from '../components/atom';
import { Button } from '../components/form/Button';
import { PageHeader, Panel } from '../components/layout';
import { useEssayGradingStatus, useTriggerEssayGrading } from '@sikao/api-client/queries/essayGradingQueries';
import { usePracticeSession } from '@sikao/api-client/queries/sessionQueries';
import styles from './EssayGradingResult.module.css';

const PENDING_STATUSES = new Set(['submitted', 'pending', 'pending_grading', 'processing']);

export function EssayGradingResult() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId?: string; submissionId?: string }>();
  const sessionId = params.sessionId ? Number(params.sessionId) : null;
  const legacySubmissionId = params.submissionId ? Number(params.submissionId) : null;
  const sessionQuery = usePracticeSession(sessionId ?? 0);
  const triggerGrading = useTriggerEssayGrading();
  const lastAutoTriggerRef = useRef<number | null>(null);
  const [kickoffError, setKickoffError] = useState<string | null>(null);

  const sessionEssaySubmissionId =
    sessionQuery.data && 'essaySubmissionId' in sessionQuery.data
      ? ((sessionQuery.data as typeof sessionQuery.data & { essaySubmissionId?: number | null }).essaySubmissionId ?? null)
      : null;
  const resolvedSubmissionId = legacySubmissionId ?? sessionEssaySubmissionId ?? null;
  const gradingQuery = useEssayGradingStatus(resolvedSubmissionId ?? 0);

  const isSessionRoute = sessionId !== null;

  useEffect(() => {
    if (resolvedSubmissionId === null || !PENDING_STATUSES.has(gradingQuery.data?.status ?? '')) {
      return;
    }
    if (gradingQuery.data?.status !== 'submitted') {
      return;
    }
    if (lastAutoTriggerRef.current === resolvedSubmissionId) {
      return;
    }
    lastAutoTriggerRef.current = resolvedSubmissionId;
    void triggerGrading.mutateAsync({
      submissionId: resolvedSubmissionId,
      idempotencyKey: `essay-grading:${resolvedSubmissionId}`,
    }).catch((error) => {
      setKickoffError(String(error));
    });
  }, [gradingQuery.data?.status, resolvedSubmissionId, triggerGrading]);

  const title = useMemo(() => {
    if (isSessionRoute && sessionId !== null) {
      return `Essay grading · Session #${sessionId}`;
    }
    if (legacySubmissionId !== null) {
      return `Essay grading · Submission #${legacySubmissionId}`;
    }
    return 'Essay grading';
  }, [isSessionRoute, legacySubmissionId, sessionId]);

  if (isSessionRoute && (sessionId === null || !Number.isInteger(sessionId) || sessionId <= 0)) {
    return <Banner variant="err" title="Invalid grading route" description="Open essay grading from a valid practice session." />;
  }

  if (legacySubmissionId !== null && (!Number.isInteger(legacySubmissionId) || legacySubmissionId <= 0)) {
    return <Banner variant="err" title="Invalid grading route" description="Open essay grading from a valid submission." />;
  }

  if (isSessionRoute && sessionQuery.isLoading) {
    return <Skeleton variant="text" lines={8} />;
  }

  if (isSessionRoute && (sessionQuery.isError || !sessionQuery.data)) {
    return <Banner variant="err" title="Session failed to load" description="Re-enter grading from Practice Center." />;
  }

  if (isSessionRoute && sessionQuery.data?.track !== 'essay') {
    return <Banner variant="err" title="Not an essay session" description="This grading page is only available for essay sessions." />;
  }

  if (resolvedSubmissionId === null) {
    return (
      <Banner
        variant="err"
        title="Essay grading bridge missing"
        description="The submitted essay session has not exposed its grading submission yet."
      />
    );
  }

  if (gradingQuery.isLoading) {
    return <Skeleton variant="text" lines={10} />;
  }

  if (gradingQuery.isError || !gradingQuery.data) {
    return <Banner variant="err" title="Essay grading failed to load" description="Retry this page later." />;
  }

  const response = gradingQuery.data;
  const report = response.report ?? null;
  const referenceAnswers = response.referenceAnswers ?? [];
  const dimensions = report?.dimensions ?? [];
  const highlights = report?.highlights ?? [];
  const issues = report?.issues ?? [];
  const improvementSuggestions = report?.improvementSuggestions ?? [];
  const isPending = PENDING_STATUSES.has(response.status);
  const isFailed = response.status === 'failed';
  const visibleKickoffError = response.status === 'submitted' ? kickoffError : null;
  const showKickoffRetry = visibleKickoffError !== null;
  const backHref = sessionId !== null ? `/practice/sessions/${sessionId}/result` : '/practice';

  return (
    <div className={styles.root} data-testid="essay-grading-view">
      <PageHeader
        title={title}
        subtitle={isPending ? 'AI 批改进行中，页面会自动刷新。' : '申论批改详情与参考答案。'}
        actions={<Button variant="secondary" onClick={() => navigate(backHref)}>Back</Button>}
      />

      {isPending ? (
        <Banner
          variant="warn"
          title="Grading in progress"
          description={triggerGrading.isPending ? 'Triggering essay grading…' : 'The server is still grading this essay submission.'}
        />
      ) : null}

      {showKickoffRetry ? (
        <Banner
          variant="err"
          title="Grading kickoff failed"
          description={visibleKickoffError}
          action={{
            label: triggerGrading.isPending ? 'Retrying…' : 'Retry grading',
            onClick: () => {
              setKickoffError(null);
              void triggerGrading.mutateAsync({
                submissionId: resolvedSubmissionId,
                idempotencyKey: `essay-grading:${resolvedSubmissionId}:retry`,
              }).catch((error) => {
                setKickoffError(String(error));
              });
            },
          }}
        />
      ) : null}

      {isFailed ? (
        <Banner
          variant="err"
          title="Grading failed"
          description={response.errorMessage ?? 'The grading job failed and can be retried.'}
          action={{
            label: triggerGrading.isPending ? 'Retrying…' : 'Retry grading',
            onClick: () => {
              void triggerGrading.mutateAsync({
                submissionId: resolvedSubmissionId,
                idempotencyKey: `essay-grading:${resolvedSubmissionId}:retry`,
              });
            },
          }}
        />
      ) : null}

      <div className={styles.grid}>
        <Panel title="Report">
          {report === null ? (
            <EmptyState
              title={isPending ? 'Waiting for report' : 'No grading report yet'}
              description="The essay report will appear here once grading completes."
            />
          ) : (
            <div className={styles.sectionList}>
              <div className={styles.reportSummary}>
                <strong>Total score</strong>
                <span>{report.totalScore ?? '-'}</span>
              </div>
              <div className={styles.reportSummary}>
                <strong>Graded at</strong>
                <span>{report.gradedAt ?? '-'}</span>
              </div>
              <div className={styles.reportSummary}>
                <strong>LLM call</strong>
                <span>{report.llmCallId ?? '-'}</span>
              </div>
              {(report.overallComment ?? '').length > 0 ? (
                <p className={styles.comment}>{report.overallComment}</p>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel title="Dimensions">
          {report === null || dimensions.length === 0 ? (
            <EmptyState title="No dimensions yet" description="Dimension scores will appear after grading completes." />
          ) : (
            <ul className={styles.dimensionList}>
              {dimensions.map((dimension) => (
                <li key={dimension.name} className={styles.dimensionItem}>
                  <div className={styles.dimensionHeader}>
                    <strong>{dimension.name}</strong>
                    <span>{dimension.score ?? '-'} / {dimension.fullScore ?? '-'}</span>
                  </div>
                  {dimension.comment ? <p className={styles.comment}>{dimension.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Highlights & issues">
          {report === null ? (
            <EmptyState title="No grading insights yet" description="Highlights and issues are generated with the grading report." />
          ) : (
            <div className={styles.dualList}>
              <section>
                <strong>Highlights</strong>
                {highlights.length === 0 ? (
                  <p className={styles.comment}>No highlights captured.</p>
                ) : (
                  <ul className={styles.bulletList}>
                    {highlights.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
              <section>
                <strong>Issues</strong>
                {issues.length === 0 ? (
                  <p className={styles.comment}>No issue list captured.</p>
                ) : (
                  <ul className={styles.bulletList}>
                    {issues.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            </div>
          )}
        </Panel>

        <Panel title="Improvement suggestions">
          {report === null || improvementSuggestions.length === 0 ? (
            <EmptyState title="No suggestions yet" description="Improvement suggestions are generated with the grading report." />
          ) : (
            <ul className={styles.bulletList}>
              {improvementSuggestions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </Panel>

        <Panel title="Reference answers">
          {referenceAnswers.length === 0 ? (
            <EmptyState title="No reference answers" description="Reference answers are not available for this submission yet." />
          ) : (
            <ul className={styles.referenceList}>
              {referenceAnswers.map((item) => (
                <li key={item.id} className={styles.referenceItem}>
                  <div className={styles.referenceMeta}>
                    <strong>{item.source}</strong>
                    <span>quality {item.qualityScore}</span>
                  </div>
                  <p className={styles.comment}>{item.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
