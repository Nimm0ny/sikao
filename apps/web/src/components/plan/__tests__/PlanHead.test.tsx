import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanHead } from '../PlanHead';

const baseProps = {
  examLabel: '2026 国考',
  daysUntilExam: 187,
  currentWeekNum: 14,
  totalWeekNum: 24,
  weekCompletedDays: 4,
  monthHours: 38,
  monthMinutes: 12,
};

describe('PlanHead', () => {
  it('渲 eyebrow + h1 + subtitle + countdown 4 区块', () => {
    render(<PlanHead {...baseProps} />);

    expect(screen.getByTestId('plan-head')).toBeInTheDocument();
    expect(screen.getByTestId('plan-head-eyebrow')).toHaveTextContent(
      '2026 国考 · WEEK 14 OF 24',
    );
    // Wave 5C P2-1: h1 用 examLabel 拼接, 跟 Login subtitle 一致.
    expect(screen.getByTestId('plan-head-title')).toHaveTextContent(
      '距 2026 国考还有 187 天。',
    );
    expect(screen.getByTestId('plan-head-subtitle')).toHaveTextContent(
      '本周 4 / 7 天已完成。本月累计 38 小时 12 分钟。',
    );
    expect(screen.getByTestId('plan-head-countdown-n')).toHaveTextContent('187');
    expect(screen.getByTestId('plan-head-countdown-l')).toHaveTextContent(
      'days · 24 weeks',
    );
  });

  it('monthHours=0 + monthMinutes=0 → subtitle 退化为单段周指标', () => {
    render(<PlanHead {...baseProps} monthHours={0} monthMinutes={0} />);
    expect(screen.getByTestId('plan-head-subtitle')).toHaveTextContent(
      '本周 4 / 7 天已完成。',
    );
    expect(screen.getByTestId('plan-head-subtitle')).not.toHaveTextContent(
      '本月累计',
    );
  });

  it('daysUntilExam < 0 → h1 改"考试已结束", countdown 显绝对值', () => {
    render(<PlanHead {...baseProps} daysUntilExam={-5} />);
    expect(screen.getByTestId('plan-head-title')).toHaveTextContent(
      '考试已结束, 看看下一次目标。',
    );
    expect(screen.getByTestId('plan-head-countdown-n')).toHaveTextContent('5');
  });

  it('weekCompletedDays > 7 (异常) → clamp 7', () => {
    render(<PlanHead {...baseProps} weekCompletedDays={99} />);
    expect(screen.getByTestId('plan-head-subtitle')).toHaveTextContent(
      '本周 7 / 7 天已完成。',
    );
  });

  it('totalWeekNum < currentWeekNum → safeTotalWeeks 取 max', () => {
    render(<PlanHead {...baseProps} currentWeekNum={20} totalWeekNum={5} />);
    expect(screen.getByTestId('plan-head-eyebrow')).toHaveTextContent(
      'WEEK 20 OF 20',
    );
    expect(screen.getByTestId('plan-head-countdown-l')).toHaveTextContent(
      'days · 20 weeks',
    );
  });
});
