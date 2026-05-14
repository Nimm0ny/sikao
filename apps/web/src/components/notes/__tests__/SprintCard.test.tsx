import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SprintCard } from '../SprintCard';

describe('SprintCard', () => {
  it('D > threshold: button disabled + 文案 "D-30 后激活"', () => {
    render(
      <SprintCard
        daysToExam={120}
        threshold={30}
        highFreqQuoteCount={5}
        methodCardCount={3}
        dailySuggestion={5}
      />,
    );
    const btn = screen.getByTestId('sprint-card-start');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('D-30 后激活');
  });

  it('D <= threshold: button enabled + 点击触发 onStart', () => {
    const start = vi.fn();
    render(
      <SprintCard
        daysToExam={20}
        threshold={30}
        highFreqQuoteCount={5}
        methodCardCount={3}
        dailySuggestion={5}
        onStart={start}
      />,
    );
    const btn = screen.getByTestId('sprint-card-start');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(start).toHaveBeenCalled();
  });

  it('渲 3 行指标 (金句池 / 方法论卡片 / 建议每日)', () => {
    render(
      <SprintCard
        daysToExam={5}
        highFreqQuoteCount={42}
        methodCardCount={11}
        dailySuggestion={5}
      />,
    );
    expect(screen.getByText('高频金句池')).toBeInTheDocument();
    expect(screen.getByText('方法论卡片')).toBeInTheDocument();
    expect(screen.getByText('建议每日复习')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });
});
