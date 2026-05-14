/**
 * Slice 3e · PracticeBreakdownCard — Profile 答题来源拆分 (plan §6).
 *
 * 接 DashboardStatsV2 的 3 个 *Answered 字段, 渲 3 行 StatRow:
 *   学习计划 N 题  (含计划内复习 — 学习计划入口包含 review_wrong task)
 *   错题复习 M 题  (仅错题本独立入口)
 *   整卷模拟 K 题
 *
 * Dumb (frontend/CLAUDE.md §2.2): 接 props, 不订 store / fetch. data
 * 加载中 (undefined) 显 skeleton 风格的 "—".
 *
 * 调性 (CLAUDE.md §1): 仅累计数陈述, 0 题仍显 "0 题" 不空态 (功能正常 vs
 * 空状态混淆), 不显百分比对比.
 */
import type { ReactElement, ReactNode } from 'react';
import { Card } from '@sikao/ui/ui/Card';
import type { DashboardStatsV2 } from '@sikao/api-client/types/api';

export interface PracticeBreakdownCardProps {
  readonly data: DashboardStatsV2 | undefined;
  // eyebrow — Profile v2 (B1) 加 sub-eyebrow 标 "实验中" 给 Slice 3e ABM 让位.
  // 接受 undefined 时不渲染 (Dashboard 等其他用途保持原观感).
  readonly eyebrow?: string;
}

interface RowProps {
  readonly label: string;
  readonly hint?: string;
  readonly value: ReactNode;
}

function Row({ label, hint, value }: RowProps) {
  return (
    <div className="flex items-baseline justify-between py-3 border-b border-line last:border-b-0">
      <span className="flex flex-col">
        <span className="text-sm text-ink-3">{label}</span>
        {hint != null ? (
          <span className="text-xs text-ink-4">{hint}</span>
        ) : null}
      </span>
      <span className="font-bold text-ink tabular-nums text-base">{value}</span>
    </div>
  );
}

function formatCount(n: number | undefined): string {
  if (n === undefined) return '—';
  return `${n} 题`;
}

export function PracticeBreakdownCard({
  data,
  eyebrow,
}: PracticeBreakdownCardProps): ReactElement {
  return (
    <Card padding="md" data-testid="profile-practice-breakdown-card">
      {eyebrow !== undefined ? (
        <div
          className="text-tiny text-ink-3 mb-2 tracking-wider"
          data-testid="profile-practice-breakdown-eyebrow"
        >
          {eyebrow}
        </div>
      ) : null}
      <h2 className="font-bold text-ink mb-3">答题来源</h2>
      <Row
        label="学习计划"
        hint="含计划内复习"
        value={formatCount(data?.studyPlanAnswered)}
      />
      <Row
        label="错题复习"
        hint="错题本独立入口"
        value={formatCount(data?.retryWrongAnswered)}
      />
      <Row label="整卷模拟" value={formatCount(data?.paperBoundAnswered)} />
    </Card>
  );
}
