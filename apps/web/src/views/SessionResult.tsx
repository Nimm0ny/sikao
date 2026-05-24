// lint-allow-ui-copy: runtime result shell copy is temporary for SIK-28.
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, EmptyState, Skeleton } from '../components/atom';
import { Button } from '../components/form/Button';
import { PageHeader, Panel } from '../components/layout';
import { Banner } from '../components/overlay';
import { usePracticeSessionResult } from '@sikao/api-client/queries/sessionQueries';
import { usePracticeTimingReport } from '@sikao/api-client/queries/sessionRuntimeQueries';
import styles from './SessionResult.module.css';

export function SessionResult() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const resultQuery = usePracticeSessionResult(sessionId);
  const timingQuery = usePracticeTimingReport(sessionId);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return <Banner variant="err" title="Invalid result page" description="Open the result page from Practice Center." />;
  }

  if (resultQuery.isLoading) {
    return <Skeleton variant="text" lines={6} />;
  }

  if (resultQuery.isError || !resultQuery.data) {
    return <Banner variant="err" title="Result page failed to load" description="Retry from Practice Center later." />;
  }

  const result = resultQuery.data;
  return (
    <div className={styles.root} data-testid="session-result-view">
      <PageHeader
        title="Practice result"
        subtitle={`Session #${sessionId}`}
        actions={<Button variant="secondary" onClick={() => navigate('/practice')}>Back to Practice Center</Button>}
      />
      <div className={styles.grid}>
        <Panel title="Summary">
          <div className={styles.list}>
            {result.summary.map((metric) => (
              <div key={metric.key} className={styles.item}>
                <strong>{metric.label}</strong>
                <div>{metric.value}</div>
                <Badge variant="neutral" size="sm">{metric.tone}</Badge>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Sections">
          {result.sections.length === 0 ? (
            <EmptyState title="No result sections" description="Detailed review modules will attach in a later batch." />
          ) : (
            <div className={styles.list}>
              {result.sections.map((section) => (
                <div key={section.key} className={styles.item}>
                  <strong>{section.title}</strong>
                  <p>{section.description}</p>
                  <Badge variant="neutral" size="sm">{section.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Timing">
          {timingQuery.isLoading ? (
            <Skeleton variant="text" lines={4} />
          ) : timingQuery.isError ? (
            <Banner
              variant="err"
              title="Timing load failed"
              description="Timing report is unavailable right now."
            />
          ) : !timingQuery.data ? (
            <EmptyState
              title="No timing data"
              description="F19 timing analysis surfaces will attach in a later batch."
            />
          ) : (
            <div className={styles.list}>
              <div className={styles.item}>Total active seconds: {timingQuery.data.totalActiveSeconds}</div>
              <div className={styles.item}>Total wall seconds: {timingQuery.data.totalWallSeconds}</div>
              <div className={styles.item}>Paused seconds: {timingQuery.data.pausedTotalSeconds}</div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
