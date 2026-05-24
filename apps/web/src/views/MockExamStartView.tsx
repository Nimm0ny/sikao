import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScopeToggle } from '../components/business';
import { EmptyState, Skeleton } from '../components/atom';
import { Button } from '../components/form/Button';
import { Banner } from '../components/overlay';
import { PageHeader, Panel } from '../components/layout';
import { useEssayPapers, useXingcePapers } from '@sikao/api-client/queries/practiceContentQueries';
import { useCreateMockExam } from '@sikao/api-client/queries/mockExamQueries';
import styles from './MockExamStartView.module.css';

type MockTrack = 'xingce' | 'essay';

function createMockExamIdempotencyKey(track: MockTrack, paperCode: string): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Mock exam creation requires crypto.randomUUID support');
  }
  return `mock-exam:${track}:${paperCode}:${crypto.randomUUID()}`;
}

export function MockExamStartView() {
  const navigate = useNavigate();
  const [track, setTrack] = useState<MockTrack>('xingce');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [delayedReviewMinutes, setDelayedReviewMinutes] = useState('0');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createMockExam = useCreateMockExam();

  const xingcePapersQuery = useXingcePapers({});
  const essayPapersQuery = useEssayPapers({});
  const papersQuery = track === 'xingce' ? xingcePapersQuery : essayPapersQuery;
  const papers = useMemo(() => papersQuery.data?.items ?? [], [papersQuery.data]);
  const eligiblePapers = useMemo(
    () => papers.filter((paper) => (paper.questionCount ?? 0) >= 30),
    [papers],
  );

  async function handleCreate(paperCode: string) {
    setErrorMessage(null);
    try {
      const response = await createMockExam.mutateAsync({
        payload: {
          paperCode,
          delayedReviewMinutes: Number(delayedReviewMinutes) || 0,
          timeLimitMinutes:
            timeLimitMinutes.trim().length > 0 ? Number(timeLimitMinutes) : undefined,
        },
        idempotencyKey: createMockExamIdempotencyKey(track, paperCode),
      });
      navigate(`/practice/sessions/${response.sessionId}`);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  return (
    <div className={styles.root} data-testid="mock-exam-start-view">
      <PageHeader
        title="Mock exam"
        subtitle="Create a strict full-set session with countdown and force-submit semantics."
        actions={<Button variant="secondary" onClick={() => navigate('/practice/mock-exam/history')}>History</Button>}
      />
      {errorMessage ? (
        <Banner
          variant="err"
          title="Mock exam creation failed"
          description={errorMessage}
          dismissible
          onDismiss={() => setErrorMessage(null)}
        />
      ) : null}
      <Panel title="Config">
        <div className={styles.controls}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Track</span>
            <ScopeToggle
              scopes={[
                { key: 'xingce', label: 'Xingce' },
                { key: 'essay', label: 'Essay' },
              ]}
              active={track}
              onChange={(value) => setTrack(value as MockTrack)}
              aria-label="Mock exam track"
            />
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Time limit (minutes)</span>
            <input
              className={styles.input}
              type="number"
              min={10}
              max={360}
              aria-label="Time limit minutes"
              value={timeLimitMinutes}
              onChange={(event) => setTimeLimitMinutes(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Delayed review (minutes)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1440}
              aria-label="Delayed review minutes"
              value={delayedReviewMinutes}
              onChange={(event) => setDelayedReviewMinutes(event.target.value)}
            />
          </label>
        </div>
      </Panel>
      <Panel title="Papers">
        {papersQuery.isLoading ? (
          <Skeleton variant="text" lines={6} />
        ) : papersQuery.isError ? (
          <Banner variant="err" title="Mock exam papers failed to load" description="Retry this page later." />
        ) : eligiblePapers.length === 0 ? (
          <EmptyState
            title="No eligible papers"
            description="Mock exams currently require papers with at least 30 questions."
          />
        ) : (
          <div className={styles.paperList}>
            {eligiblePapers.map((paper) => (
              <div key={paper.id} className={styles.paperItem}>
                <div className={styles.paperMeta}>
                  <span className={styles.paperTitle}>{paper.title}</span>
                  <span className={styles.paperSubtitle}>
                    {paper.paperCode ?? paper.id} / {paper.questionCount ?? 0} questions
                  </span>
                </div>
                <Button
                  variant="primary"
                  disabled={createMockExam.isPending}
                  onClick={() => void handleCreate(paper.paperCode ?? paper.id)}
                >
                  Create mock exam
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
