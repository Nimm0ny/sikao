import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@sikao/ui/ui';
import { useRefreshRecommendations } from '@sikao/api-client/recommendationsQueries';
import type { ProgressDiagnosisResponseV2 } from '@sikao/api-client/types/home';

interface DiagnosisReportProps {
  readonly diagnosis: ProgressDiagnosisResponseV2;
}

function ListBlock({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[] | undefined;
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-4">
      <div className="text-sm font-medium text-ink">{title}</div>
      {items && items.length > 0 ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-3">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-sm text-ink-3">暂无内容。</div>
      )}
    </div>
  );
}

export function DiagnosisReport({ diagnosis }: DiagnosisReportProps) {
  const navigate = useNavigate();
  const refreshMutation = useRefreshRecommendations();
  const refreshError = refreshMutation.isError
    ? refreshMutation.error instanceof Error
      ? refreshMutation.error.message
      : String(refreshMutation.error)
    : null;

  return (
    <Card padding="md" className="border-line bg-surface" data-testid="profile-learning-diagnosis">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
            诊断报告
          </div>
          <div className="mt-2 font-serif text-2xl text-ink">当前学习诊断</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            isLoading={refreshMutation.isPending}
            onClick={() =>
              refreshMutation.mutate({
                payload: { trigger: 'profile-learning-diagnosis' },
              })
            }
          >
            刷新今日推荐
          </Button>
          <Button
            variant="quiet"
            onClick={() => navigate('/dashboard')}
          >
            去看首页推荐
          </Button>
        </div>
      </div>

      {refreshError ? (
        <div className="mt-4 rounded-card border border-err bg-err-bg p-3 text-sm text-err">
          刷新今日推荐失败：{refreshError}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ListBlock title="优势" items={diagnosis.strengths} />
        <ListBlock title="薄弱点" items={diagnosis.weaknesses} />
        <ListBlock title="建议" items={diagnosis.suggestions} />
      </div>
    </Card>
  );
}
