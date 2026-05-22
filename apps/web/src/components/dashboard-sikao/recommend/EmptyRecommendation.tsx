import { EmptyState } from '@sikao/ui/ui';

export function EmptyRecommendation() {
  return (
    <EmptyState
      title="当前没有今日推荐"
      description="recommendations/today 目前为空，可以手动刷新生成新的建议卡。"
    />
  );
}
