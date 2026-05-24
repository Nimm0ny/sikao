import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState, Skeleton } from '../components/atom';
import { Button } from '../components/form/Button';
import { Banner } from '../components/overlay';
import { PageHeader, Panel } from '../components/layout';
import { useMockExamComparison } from '@sikao/api-client/queries/mockExamQueries';
import styles from './MockExamComparisonView.module.css';

export function MockExamComparisonView() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const comparisonQuery = useMockExamComparison(sessionId);
  const selfHistory = comparisonQuery.data?.selfHistory ?? [];
  const paperBaseline = comparisonQuery.data?.paperBaseline ?? {};

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return <Banner variant="err" title="Invalid comparison page" description="Open comparison from mock exam history." />;
  }

  return (
    <div className={styles.root} data-testid="mock-exam-comparison-view">
      <PageHeader
        title="Mock exam comparison"
        subtitle={`Session #${sessionId}`}
        actions={<Button variant="secondary" onClick={() => navigate('/practice/mock-exam/history')}>Back to history</Button>}
      />
      {comparisonQuery.isLoading ? (
        <Skeleton variant="text" lines={8} />
      ) : comparisonQuery.isError || !comparisonQuery.data ? (
        <Banner variant="err" title="Mock exam comparison failed to load" description="Retry this page later." />
      ) : (
        <div className={styles.grid}>
          <Panel title="Current">
            <div className={styles.item}>
              Paper: {comparisonQuery.data.self.paperCode}
              <br />
              Accuracy: {comparisonQuery.data.self.accuracy}
              <br />
              Active seconds: {comparisonQuery.data.self.actualActiveSeconds}
              <br />
              Force submitted: {comparisonQuery.data.self.isForceSubmitted ? 'yes' : 'no'}
              {comparisonQuery.data.self.rankInSelf !== null && comparisonQuery.data.self.rankInSelf !== undefined ? (
                <>
                  <br />
                  Rank in self: {comparisonQuery.data.self.rankInSelf}
                </>
              ) : null}
              {comparisonQuery.data.self.totalScore !== null && comparisonQuery.data.self.totalScore !== undefined ? (
                <>
                  <br />
                  Total score: {comparisonQuery.data.self.totalScore}
                </>
              ) : null}
            </div>
          </Panel>
          <Panel title="Self history">
            {selfHistory.length === 0 ? (
              <EmptyState title="No previous sessions" description="This is the first recorded attempt for this paper." />
            ) : (
              <div className={styles.list}>
                {selfHistory.map((session) => (
                  <div key={session.sessionId} className={styles.item}>
                    Session #{session.sessionId}
                    <br />
                    Accuracy: {session.accuracy}
                    <br />
                    Active seconds: {session.actualActiveSeconds}
                    <br />
                    Force submitted: {session.isForceSubmitted ? 'yes' : 'no'}
                    {session.rankInSelf !== null && session.rankInSelf !== undefined ? (
                      <>
                        <br />
                        Rank in self: {session.rankInSelf}
                      </>
                    ) : null}
                    {session.totalScore !== null && session.totalScore !== undefined ? (
                      <>
                        <br />
                        Total score: {session.totalScore}
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Paper baseline">
            {Object.keys(paperBaseline).length === 0 ? (
              <EmptyState title="No paper baseline" description="Paper-wide baseline is not enabled in this stage." />
            ) : (
              <div className={styles.list}>
                {Object.entries(paperBaseline).map(([key, value]) => (
                  <div key={key} className={styles.item}>
                    {key}: {String(value)}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
