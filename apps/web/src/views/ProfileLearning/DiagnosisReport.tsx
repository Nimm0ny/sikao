// lint-allow-ui-copy: V5 ProfileLearning DiagnosisReport copy.
import { useProgressDiagnosis } from '@sikao/api-client/progressQueries';
import { Panel } from '../../components/layout';
import { Skeleton, Badge } from '../../components/atom';
import { EmptyState } from '../../components/atom/EmptyState';
import styles from './DiagnosisReport.module.css';

/*
 * DiagnosisReport — strengths / weaknesses / suggestions feed from
 * useProgressDiagnosis. Each list rendered as a labeled section with
 * a tone Badge (ok / warn / info). No chart dependency.
 */

export function DiagnosisReport() {
  const query = useProgressDiagnosis();

  if (query.isLoading) {
    return (
      <Panel title="AI 诊断报告">
        <div role="status" aria-label="诊断报告加载中" data-testid="diagnosis-report-loading">
          <Skeleton variant="text" lines={4} />
        </div>
      </Panel>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Panel title="AI 诊断报告">
        <div data-testid="diagnosis-report-error">
          <EmptyState title="无法加载诊断报告" description={String((query.error as Error | null)?.message ?? '稍后再试')} />
        </div>
      </Panel>
    );
  }

  const { strengths = [], weaknesses = [], suggestions = [] } = query.data;

  return (
    <Panel title="AI 诊断报告">
      <div data-testid="diagnosis-report" className={styles.root}>
        <DiagnosisGroup title="优势" tone="ok" items={strengths} testId="diagnosis-strengths" />
        <DiagnosisGroup title="需要加强" tone="warn" items={weaknesses} testId="diagnosis-weaknesses" />
        <DiagnosisGroup title="行动建议" tone="info" items={suggestions} testId="diagnosis-suggestions" />
      </div>
    </Panel>
  );
}

interface DiagnosisGroupProps {
  readonly title: string;
  readonly tone: 'ok' | 'warn' | 'info';
  readonly items: ReadonlyArray<string>;
  readonly testId: string;
}

function DiagnosisGroup({ title, tone, items, testId }: DiagnosisGroupProps) {
  if (items.length === 0) return null;
  return (
    <section data-testid={testId} aria-label={title}>
      <Badge variant={tone} size="sm">{title}</Badge>
      <ul className={styles.list}>
        {items.map((line, idx) => <li key={idx} className={styles.item}>{line}</li>)}
      </ul>
    </section>
  );
}
