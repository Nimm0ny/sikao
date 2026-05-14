import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanAssistant } from '../PlanAssistant';

describe('PlanAssistant', () => {
  it('渲 eyebrow + narrative + 2 actions', () => {
    const onKeep = vi.fn();
    const onAdjust = vi.fn();
    render(
      <PlanAssistant
        narrative="本周节奏比上周快了 14%。资料分析连续三天没安排，是不是该调一下？"
        actions={[
          { id: 'keep', label: '不用，按原计划', variant: 'secondary', onClick: onKeep },
          { id: 'adjust', label: '好，调整一下', variant: 'primary', onClick: onAdjust },
        ]}
      />,
    );
    expect(screen.getByTestId('plan-assistant-eyebrow')).toHaveTextContent(
      'PLAN ASSISTANT',
    );
    expect(screen.getByTestId('plan-assistant-narrative')).toHaveTextContent(
      '本周节奏比上周快了 14%',
    );
    expect(screen.getByTestId('plan-assistant-action-keep')).toHaveTextContent(
      '不用，按原计划',
    );
    expect(
      screen.getByTestId('plan-assistant-action-adjust'),
    ).toHaveTextContent('好，调整一下');
  });

  it('点 action 触发对应 onClick', async () => {
    const user = userEvent.setup();
    const onKeep = vi.fn();
    const onAdjust = vi.fn();
    render(
      <PlanAssistant
        narrative="test"
        actions={[
          { id: 'keep', label: 'A', variant: 'secondary', onClick: onKeep },
          { id: 'adjust', label: 'B', variant: 'primary', onClick: onAdjust },
        ]}
      />,
    );
    await user.click(screen.getByTestId('plan-assistant-action-keep'));
    expect(onKeep).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('plan-assistant-action-adjust'));
    expect(onAdjust).toHaveBeenCalledTimes(1);
  });

  it('headline 默认值 "PLAN ASSISTANT", 可 override', () => {
    render(
      <PlanAssistant
        headline="DAILY HINT"
        narrative="x"
        actions={[]}
      />,
    );
    expect(screen.getByTestId('plan-assistant-eyebrow')).toHaveTextContent(
      'DAILY HINT',
    );
  });
});
