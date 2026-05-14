import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChatIcon,
  ChevronRightIcon,
  FileTextIcon,
  LogoutIcon,
  SubjectDashboardIcon,
  SubjectPlanIcon,
} from '@sikao/ui/icons';
import type { IconProps } from '@sikao/ui/icons';
import { Button, Card } from '@sikao/ui/ui';
import { AccountSecuritySection } from '@/components/profile/AccountSecuritySection';
import { EmailPanel } from '@/components/profile/EmailPanel';
import {
  ProfileSidePanel,
  type ProfileStatsData,
} from '@/components/profile/ProfileSidePanel';
import { ProfileBasicInfo } from '@/components/profile/ProfileBasicInfo';
import { ProfilePreferences } from '@/components/profile/ProfilePreferences';
import { ProfileSubscriptionCard } from '@/components/profile/ProfileSubscriptionCard';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';
import {
  dashboardKeys,
  fetchDashboardSummary,
} from '@sikao/api-client/apiQueries';

// Profile · SIKAO redesign Wave 1 · view 08 hifi 升级.
//
// Layout (hifi `.profile-grid` 1280 canvas grid 280|1fr):
//   left  → ProfileSidePanel  (avatar + name + stats 5 行)
//   right → ProfileBasicInfo  (ACCOUNT eyebrow + h3 + 5 kv)
//        → AccountSecuritySection  (邮箱 / 手机 / 修改密码 row)
//        → EmailPanel              (邮箱状态卡 — 留作 v1 显式入口, 与
//                                   AccountSecuritySection 互补)
//        → LearningToolsCard       (4 学习入口 — Profile.test 黑名单只
//                                   禁旧 data card, 学习入口必须保留)
//        → ProfilePreferences      (主题 chip + 提醒 + 字号 + 快捷键)
//        → ProfileSubscriptionCard (订阅大卡 mock)
//   外置 → 退出登录 Button (border-t 分隔, identityCard 之外, 满足
//          Profile.test "logout outside identity card" 断言)
//
// stats 数据流:
//   - currentStreakDays / totalAnswered / totalWrongQuestions ← BE
//     /practice/stats/summary (DashboardStatsV2)
//   - cumulativeHours / membershipTier / examTarget / examRegion /
//     dailyReminder / fontSizeLabel / shortcutsOn / subscription* ←
//     mock + TODO (BE 暂无对应字段, 待 owner ship 后再 wire).
//
// Fail-fast: stats query 失败时 useQuery 返回 isError, 但数字 fallback
// 走 null → 显 "—" (CLAUDE.md §4 Fail-Fast 例外: stats 是 read-only
// caption-level 信息, 失败不阻塞 view 渲染. 跟 Dashboard 处理一致).

interface LearningToolEntry {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly testId: string;
  readonly icon: ComponentType<IconProps>;
}

const LEARNING_TOOL_ENTRIES: readonly LearningToolEntry[] = [
  {
    path: '/dashboard',
    label: '学情数据',
    description: '查看累计练习、正确率和错题沉淀',
    testId: 'profile-dashboard-entry',
    icon: SubjectDashboardIcon,
  },
  {
    path: '/plan',
    label: '学习计划',
    description: '回看历史计划和阶段安排',
    testId: 'profile-study-plan-entry',
    icon: SubjectPlanIcon,
  },
  {
    path: '/essay/history',
    label: '我的申论',
    description: '查看申论批改和示范答案',
    testId: 'profile-essay-history-entry',
    icon: FileTextIcon,
  },
  {
    path: '/conversations',
    label: '解析问答',
    description: '查看过去的问答记录',
    testId: 'profile-conversations-entry',
    icon: ChatIcon,
  },
] as const;

function LearningToolsCard() {
  const navigate = useNavigate();

  return (
    <Card padding="md" data-testid="profile-learning-tools-card">
      <div className="mb-3">
        <h2 className="font-serif text-lg font-medium text-ink">学习与工具</h2>
        <p className="mt-1 text-sm text-ink-3">
          完整数据和历史记录收进独立页面。
        </p>
      </div>
      <div className="divide-y divide-line">
        {LEARNING_TOOL_ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.path}
              type="button"
              onClick={() => navigate(entry.path)}
              className="w-full flex items-center justify-between gap-3 py-3 text-left first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-card"
              data-testid={entry.testId}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="w-5 h-5 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{entry.label}</span>
                  <span className="block text-sm text-ink-3">{entry.description}</span>
                </span>
              </span>
              <ChevronRightIcon className="w-5 h-5 shrink-0 text-ink-3" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── stats mock fallback (TODO BE) ──────────────────────────────────────────
// BE 暂无 cumulativeHours / membershipTier 字段, 用 mock 让 hifi 调性
// 完整可见; ship 时 BE owner ship /me/profile-summary 后再 wire.
const STATS_MOCK = {
  cumulativeHours: null,
  membershipTier: null,
} as const;

const PROFILE_MOCK = {
  // TODO(2026-05-20 BE owner): ship /me/profile API 返这些字段.
  examTarget: null,
  examRegion: null,
  dailyReminder: null,
  fontSizeLabel: '中 · 15 px',
  shortcutsOn: true,
  subscription: {
    tierLabel: 'PREMIUM',
    billingCycle: '月度订阅',
    renewDate: null,
    perks: ['完整真题库', '申论批改', 'AI 解析', '学习计划生成'],
    priceLabel: '¥38',
    priceCycle: '月',
  },
} as const;

function useProfileStats(): ProfileStatsData {
  const query = useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: fetchDashboardSummary,
    staleTime: 30_000,
  });
  const summary = query.data;
  return {
    currentStreakDays: summary?.currentStreakDays ?? null,
    totalAnswered: summary?.totalAnswered ?? null,
    totalWrongQuestions: summary?.totalWrongQuestions ?? null,
    cumulativeHours: STATS_MOCK.cumulativeHours,
    membershipTier: STATS_MOCK.membershipTier,
  };
}

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();
  const stats = useProfileStats();

  const handleLogout = async (): Promise<void> => {
    // FAIL-FAST EXCEPTION (lhr authorized 2026-05-11): logout backend 失败也要本地 clearSession.
    // 历史: commit 8089989 引入该降级未登记, Wave 1 Round 2 补登记 (master autonomy).
    // Registered: docs/engineering/fail-fast-exceptions.md#auth-logout-graceful-clear
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      logger.warn('auth.logout.backend_failed', { err: String(err) });
    }
    clearSession();
    navigate('/login');
  };

  if (user === null) {
    // RedirectGuard 已 push /login, 这里返 null 防 SSR 闪烁.
    return null;
  }

  return (
    <div
      className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10"
      data-testid="profile-view"
    >
      <div
        className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 md:gap-12"
        data-testid="profile-identity-card"
      >
        <ProfileSidePanel
          user={user}
          stats={stats}
          memberSince={null}
        />

        <main className="space-y-12 min-w-0">
          <ProfileBasicInfo
            user={user}
            examTarget={PROFILE_MOCK.examTarget}
            examRegion={PROFILE_MOCK.examRegion}
          />

          <div className="space-y-4">
            <AccountSecuritySection />
            <EmailPanel />
            <LearningToolsCard />
          </div>

          {/* TODO(2026-05-20 frontend): wire themeKey to useTweaks() / <html data-theme> localStorage,
              当前 hardcode "quiet" (静读) 是 SIKAO 默认主题. Tweaks panel 切换后此处 reflect 真实主题. */}
          <ProfilePreferences
            themeKey="quiet"
            dailyReminder={PROFILE_MOCK.dailyReminder}
            fontSizeLabel={PROFILE_MOCK.fontSizeLabel}
            shortcutsOn={PROFILE_MOCK.shortcutsOn}
          />

          <ProfileSubscriptionCard
            tierLabel={PROFILE_MOCK.subscription.tierLabel}
            billingCycle={PROFILE_MOCK.subscription.billingCycle}
            renewDate={PROFILE_MOCK.subscription.renewDate}
            perks={PROFILE_MOCK.subscription.perks}
            priceLabel={PROFILE_MOCK.subscription.priceLabel}
            priceCycle={PROFILE_MOCK.subscription.priceCycle}
            onManage={() => {
              logger.info('profile.subscription.manage_click', {});
            }}
          />
        </main>
      </div>

      <div className="mt-12 pt-6 border-t border-line">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<LogoutIcon className="w-4 h-4" />}
          onClick={() => {
            void handleLogout();
          }}
          data-testid="profile-logout-btn"
        >
          退出登录
        </Button>
      </div>
    </div>
  );
}
