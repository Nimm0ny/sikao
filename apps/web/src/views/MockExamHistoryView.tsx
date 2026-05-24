import { useNavigate } from 'react-router-dom';
import { EmptyState, Skeleton } from '../components/atom';
import { Button } from '../components/form/Button';
import { Banner } from '../components/overlay';
import { PageHeader, Panel } from '../components/layout';
import { useMockExamHistory } from '@sikao/api-client/queries/mockExamQueries';
import styles from './MockExamHistoryView.module.css';

export function MockExamHistoryView() {
  const navigate = useNavigate();
  const historyQuery = useMockExamHistory();
  const sessions = historyQuery.data?.sessions ?? [];

  return (
    <div className={styles.root} data-testid="mock-exam-history-view">
      <PageHeader
        title="Mock exam history"
        subtitle="Track prior attempts, force-submit markers, and comparison entry points."
        actions={<Button variant="secondary" onClick={() => navigate('/practice/mock-exam/start')}>New mock exam</Button>}
      />
      {historyQuery.isLoading ? (
        <Skeleton variant="text" lines={8} />
      ) : historyQuery.isError || !historyQuery.data ? (
        <Banner variant="err" title="Mock exam history failed to load" description="Retry this page later." />
      ) : sessions.length === 0 ? (
        <EmptyState title="No mock exam history" description="Create your first mock exam from the start view." />
      ) : (
        <>
          <Panel title="Aggregate">
            <div className={styles.aggregateGrid}>
              <div className={styles.aggregateCard}>
                <div className={styles.aggregateLabel}>Total count</div>
                <div className={styles.aggregateValue}>{historyQuery.data.aggregate.totalCount}</div>
              </div>
              <div className={styles.aggregateCard}>
                <div className={styles.aggregateLabel}>Best accuracy</div>
                <div className={styles.aggregateValue}>{historyQuery.data.aggregate.bestAccuracy}</div>
              </div>
              <div className={styles.aggregateCard}>
                <div className={styles.aggregateLabel}>Average accuracy</div>
                <div className={styles.aggregateValue}>{historyQuery.data.aggregate.avgAccuracy}</div>
              </div>
              <div className={styles.aggregateCard}>
                <div className={styles.aggregateLabel}>Improvement trend</div>
                <div className={styles.aggregateValue}>{historyQuery.data.aggregate.improvementTrend}</div>
              </div>
            </div>
          </Panel>
          <Panel title="Sessions">
            <div className={styles.sessionList}>
              {sessions.map((session) => (
                <div key={session.sessionId} className={styles.sessionItem}>
                  <div>
                    <div className={styles.sessionTitle}>{session.paperCode}</div>
                    <div className={styles.sessionMeta}>
                      Accuracy: {session.accuracy} / Active seconds: {session.actualActiveSeconds}
                      {session.totalScore !== null && session.totalScore !== undefined ? ` / Score: ${session.totalScore}` : ''}
                      {session.rankInSelf !== null && session.rankInSelf !== undefined ? ` / Rank: ${session.rankInSelf}` : ''}
                      {session.isForceSubmitted ? ' / Force submitted' : ' / Submitted normally'}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/practice/mock-exam/${session.sessionId}/comparison`)}
                  >
                    View comparison
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
