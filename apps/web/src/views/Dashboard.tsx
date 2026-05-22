import { useEffect } from 'react';

import { useProfileInfo } from '@sikao/api-client/profileQueries';
import { useDashboardPreferenceStore } from '@sikao/domain/dashboard/useDashboardPreferenceStore';
import { SectionErrorBoundary } from '@sikao/ui/ui';

import { MvpPage } from '@/components/mvp';
import { PlanSection } from '@/components/dashboard-sikao/plan/PlanSection';
import { ProgressSection } from '@/components/dashboard-sikao/progress/ProgressSection';
import { RecommendationSection } from '@/components/dashboard-sikao/recommend/RecommendationSection';

export default function Dashboard() {
  const profileInfoQuery = useProfileInfo();
  const bootstrapPreferences = useDashboardPreferenceStore(
    (state) => state.bootstrapFromProfileInfo,
  );
  const hydratePreferences = useDashboardPreferenceStore(
    (state) => state.hydrateFromLocalFallback,
  );

  useEffect(() => {
    if (profileInfoQuery.data) {
      bootstrapPreferences(profileInfoQuery.data);
      return;
    }
    if (!profileInfoQuery.isError) {
      hydratePreferences();
    }
  }, [
    bootstrapPreferences,
    hydratePreferences,
    profileInfoQuery.data,
    profileInfoQuery.isError,
  ]);

  return (
    <MvpPage
      eyebrow="Home Phase M10"
      title="首页"
      subtitle="当前首页按真实 runtime 聚合为三段：Section A 学习计划、Section B 学习进度、Section C 今日推荐。"
      testId="dashboard-home-view"
    >
      <div className="space-y-6">
        <SectionErrorBoundary
          title="Section A 渲染失败"
          description="计划 runtime 发生未捕获异常，请重试。"
          resetKey="dashboard-section-a"
        >
          <PlanSection />
        </SectionErrorBoundary>
        <SectionErrorBoundary
          title="Section B 渲染失败"
          description="学习进度 runtime 发生未捕获异常，请重试。"
          resetKey="dashboard-section-b"
        >
          <ProgressSection />
        </SectionErrorBoundary>
        <SectionErrorBoundary
          title="Section C 渲染失败"
          description="今日推荐 runtime 发生未捕获异常，请重试。"
          resetKey="dashboard-section-c"
        >
          <RecommendationSection />
        </SectionErrorBoundary>
      </div>
    </MvpPage>
  );
}
