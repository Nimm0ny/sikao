import type { AuthUserSummary } from '@sikao/domain/auth/useAuthStore';

// ProfileSidePanel · SIKAO redesign Wave 1 · view 08 hifi 左侧栏.
//
// hifi 原型 (design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html L3372-3385):
//   - .profile-side (1px right rule, padding-right s6):
//     - .av 100×100 ink bg / paper text / serif 44 (这里收口到 64 — hifi 是
//       1280 canvas 100px; app 实际 max-width 920 用 64px 视觉权重对齐).
//     - h2 姓名 serif 24 不带 italic.
//     - .meta @username · 加入于 YYYY-MM-DD (mono 12 ink-3).
//     - .stats 5 行 (label k/value v 上下分行):
//       连续打卡 / 累计时长 / 累计题量 / 错题 / 当前会员.
//
// 数据契约:
//   - user (AuthUserSummary): displayName / username / createdAt? — 来自
//     useAuthStore. createdAt BE 暂无 (AuthUserSummary 不含), mock + TODO.
//   - stats (props): currentStreakDays / totalAnswered / totalWrongQuestions
//     来自 DashboardStatsV2; cumulativeHours / membershipTier BE 暂无,
//     caller 传 mock + TODO.
//
// italic 政策: stats 数值走 font-mono tabular (DashboardStats 数字阶梯惯例);
// "Premium" 会员等级 label 走 font-serif 不 italic (CLAUDE.md §4 CJK/拉丁不
// italic, 数字+serif 才能 italic).
//
// Radius: av 走 rounded-card (与 hifi `.av` 默认无圆角一致 — SIKAO paper 风格
// 几乎不用大圆角, 头像方形更克制. 圆形头像不是 SIKAO 调性).

export interface ProfileStatsData {
  readonly currentStreakDays: number | null;
  readonly cumulativeHours: number | null;
  readonly totalAnswered: number | null;
  readonly totalWrongQuestions: number | null;
  readonly membershipTier: string | null;
}

export interface ProfileSidePanelProps {
  readonly user: AuthUserSummary;
  readonly stats: ProfileStatsData;
  readonly memberSince: string | null;
}

interface StatRowProps {
  readonly label: string;
  readonly value: string;
  readonly variant?: 'mono' | 'serif';
  readonly testId?: string;
}

function StatRow({ label, value, variant = 'mono', testId }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-line text-sm text-ink-3 last:border-b-0">
      <span>{label}</span>
      <span
        className={
          variant === 'mono'
            ? 'font-mono tabular-nums text-ink'
            : 'font-serif text-ink'
        }
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('en-US');
}

function formatHours(h: number | null): string {
  if (h === null) return '—';
  return `${h.toFixed(1)} h`;
}

function formatStreak(d: number | null): string {
  if (d === null) return '—';
  return `${d} 天`;
}

export function ProfileSidePanel({ user, stats, memberSince }: ProfileSidePanelProps) {
  const displayName = user.displayName ?? user.username ?? '匿名';
  const firstChar = displayName[0] ?? '?';
  const handle = user.username ?? 'guest';
  const meta = memberSince !== null
    ? `@${handle} · 加入于 ${memberSince}`
    : `@${handle}`;

  return (
    <aside
      className="md:border-r md:border-line md:pr-8"
      data-testid="profile-side-panel"
    >
      <div
        className="w-16 h-16 bg-ink text-paper grid place-items-center font-serif text-2xl font-medium rounded-card mb-4"
        aria-hidden="true"
      >
        {firstChar}
      </div>
      <h2
        className="font-serif text-2xl font-medium text-ink mb-1"
        data-testid="profile-display-name"
      >
        {displayName}
      </h2>
      <p className="font-mono text-xs text-ink-3 tabular-nums">{meta}</p>

      <div className="mt-6 border-t border-line">
        <StatRow
          label="连续打卡"
          value={formatStreak(stats.currentStreakDays)}
          testId="profile-stat-streak"
        />
        <StatRow
          label="累计时长"
          value={formatHours(stats.cumulativeHours)}
          testId="profile-stat-hours"
        />
        <StatRow
          label="累计题量"
          value={formatNumber(stats.totalAnswered)}
          testId="profile-stat-answered"
        />
        <StatRow
          label="错题"
          value={formatNumber(stats.totalWrongQuestions)}
          testId="profile-stat-wrong"
        />
        <StatRow
          label="当前会员"
          value={stats.membershipTier ?? '—'}
          variant="serif"
          testId="profile-stat-tier"
        />
      </div>
    </aside>
  );
}
