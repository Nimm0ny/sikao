/**
 * Slice 3e · PracticeBreakdownCard 测试 (plan §7 commit 1 3 vitest).
 *
 * 覆盖:
 * 1. data 全有 → 3 行各显数字 + 文案
 * 2. data 全 0 → 仍显 "0 题" 不空态 (调性: 功能正常 vs 空状态)
 * 3. data 缺字段 (老 BE 未 deploy) → 降级显 "—" 向后兼容
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PracticeBreakdownCard } from '../PracticeBreakdownCard';
import type { DashboardStatsV2 } from '@sikao/api-client/types/api';

function buildStats(overrides: Partial<DashboardStatsV2> = {}): DashboardStatsV2 {
  return {
    totalAnswered: 0,
    overallAccuracy: 0,
    currentStreakDays: 0,
    masteredPointsCount: 0,
    totalWrongQuestions: 0,
    studyPlanAnswered: 0,
    retryWrongAnswered: 0,
    paperBoundAnswered: 0,
    ...overrides,
  };
}

describe('PracticeBreakdownCard', () => {
  it('data 全有 → 3 行各显数字 + 文案', () => {
    render(
      <PracticeBreakdownCard
        data={buildStats({
          studyPlanAnswered: 12,
          retryWrongAnswered: 25,
          paperBoundAnswered: 80,
        })}
      />,
    );
    expect(screen.getByText('答题来源')).toBeInTheDocument();
    expect(screen.getByText('学习计划')).toBeInTheDocument();
    expect(screen.getByText('错题复习')).toBeInTheDocument();
    expect(screen.getByText('整卷模拟')).toBeInTheDocument();
    expect(screen.getByText('12 题')).toBeInTheDocument();
    expect(screen.getByText('25 题')).toBeInTheDocument();
    expect(screen.getByText('80 题')).toBeInTheDocument();
  });

  it('data 全 0 → 仍显 "0 题" 不走空态', () => {
    render(<PracticeBreakdownCard data={buildStats()} />);
    // 3 行都显 "0 题", 不显 "还没有答题" / "暂无数据" 之类空态文案
    const zeros = screen.getAllByText('0 题');
    expect(zeros.length).toBe(3);
    expect(screen.queryByText(/还没有/)).not.toBeInTheDocument();
    expect(screen.queryByText(/暂无/)).not.toBeInTheDocument();
  });

  it('data undefined (加载中) → 3 行显 "—"', () => {
    render(<PracticeBreakdownCard data={undefined} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(3);
  });
});
