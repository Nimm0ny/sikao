import { Button, EmptyState, Skeleton } from '@sikao/ui/ui';
import {
  useProgressDiagnosis,
  useProgressOverview,
} from '@sikao/api-client/progressQueries';

import { MvpPage } from '@/components/mvp';
import { DiagnosisReport } from '@/components/profile/learning/DiagnosisReport';
import { LearningHeader } from '@/components/profile/learning/LearningHeader';
import { PlanSliceCard } from '@/components/profile/learning/PlanSliceCard';
import { TimeseriesChart } from '@/components/profile/learning/TimeseriesChart';
import { WeaknessRadar } from '@/components/profile/learning/WeaknessRadar';

export default function ProfileLearning() {
  const overviewQuery = useProgressOverview();
  const diagnosisQuery = useProgressDiagnosis();
  const isLoading = overviewQuery.isLoading || diagnosisQuery.isLoading;
  const isError = overviewQuery.isError || diagnosisQuery.isError;

  return (
    <MvpPage
      eyebrow="Home Phase M10"
      title="详细学情"
      subtitle="这里承接首页 Section B 的钻取：看计划切片、分科雷达、全量趋势和诊断建议。"
      testId="profile-learning-view"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton heightClass="h-32" />
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton heightClass="h-80" />
            <Skeleton heightClass="h-80" />
          </div>
          <Skeleton heightClass="h-64" />
        </div>
      ) : isError ? (
        <EmptyState
          tone="error"
          title="详细学情加载失败"
          description="overview 或 diagnosis 数据不可用，请重试。"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void overviewQuery.refetch();
                void diagnosisQuery.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      ) : overviewQuery.data && diagnosisQuery.data ? (
        <div className="space-y-4">
          <LearningHeader overview={overviewQuery.data} />
          <PlanSliceCard overview={overviewQuery.data} />
          <div className="grid gap-4 xl:grid-cols-2">
            <WeaknessRadar overview={overviewQuery.data} />
            <TimeseriesChart />
          </div>
          <DiagnosisReport diagnosis={diagnosisQuery.data} />
        </div>
      ) : (
        <EmptyState
          title="暂无详细学情"
          description="当前还没有足够的 progress 数据生成详细页。"
        />
      )}
    </MvpPage>
  );
}
