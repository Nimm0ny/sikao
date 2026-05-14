import { Link } from 'react-router-dom';
import { Card } from '@sikao/ui/ui';
import {
  ChatIcon,
  SubjectDashboardIcon,
  SubjectEssayIcon,
  SubjectPlanIcon,
} from '@sikao/ui/icons';

// HomeMoreFeatures — 学习中心首页 footer "更多功能" link grid. 4 入口跳分散
// 模块: 解析问答 / 我的申论 / 学习计划 / 学情数据. 这些在 sidebar 不
// 占主位 (太细颗粒度), 通过 Home footer 让用户感知 + 一键直达.
//
// 用 react-router Link (非 button + onClick navigate) — a11y + 中键开新 tab +
// hover URL 预览全部回来. (subagent review 2026-05-08 P2 #4)

interface FeatureLink {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof ChatIcon;
  readonly to: string;
  readonly testId: string;
}

const FEATURES: readonly FeatureLink[] = [
  {
    key: 'conversations',
    title: '解析问答',
    description: '回看过往提问和答复脉络',
    icon: ChatIcon,
    to: '/conversations',
    testId: 'home-feature-conversations',
  },
  {
    key: 'essay-history',
    title: '我的申论',
    description: '查看历次批改和对照答案',
    icon: SubjectEssayIcon,
    to: '/essay/history',
    testId: 'home-feature-essay-history',
  },
  {
    key: 'study-plan',
    title: '学习计划',
    description: '查看今日安排和周计划',
    icon: SubjectPlanIcon,
    to: '/plan',
    testId: 'home-feature-study-plan',
  },
  {
    key: 'dashboard',
    title: '学情数据',
    description: '查看练习表现和复盘指标',
    icon: SubjectDashboardIcon,
    to: '/dashboard',
    testId: 'home-feature-dashboard',
  },
];

export function HomeMoreFeatures() {
  return (
    <Card padding="md" data-testid="home-more-features">
      <div className="mb-3">
        <span className="text-tiny font-semibold text-ink-3">更多功能</span>
        <h2 className="mt-1 text-lg font-bold text-ink">深入用</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FEATURES.map((f) => (
          <FeatureLinkItem key={f.key} feature={f} />
        ))}
      </div>
    </Card>
  );
}

interface FeatureLinkItemInput {
  readonly feature: FeatureLink;
}

function FeatureLinkItem({ feature }: FeatureLinkItemInput) {
  const Icon = feature.icon;
  return (
    <Link
      to={feature.to}
      className="flex items-start gap-3 p-3 rounded-tiny border border-line bg-surface hover:border-ink hover:bg-surface-alt transition-colors text-left"
      data-testid={feature.testId}
    >
      <Icon size={20} className="text-ink-3 shrink-0 mt-1" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{feature.title}</div>
        <div className="text-xs text-ink-3 mt-1 line-clamp-2">{feature.description}</div>
      </div>
    </Link>
  );
}
