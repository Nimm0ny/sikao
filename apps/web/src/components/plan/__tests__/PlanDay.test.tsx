import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanDay, type PlanDayProps } from '../PlanDay';

function build(overrides: Partial<PlanDayProps> = {}): PlanDayProps {
  return {
    dayLabel: 'M · 5',
    date: '2026-05-05',
    status: 'future',
    tasks: [
      { id: 't1', title: '资料 · 增长率', tone: 'normal', clickable: true },
    ],
    ...overrides,
  };
}

describe('PlanDay', () => {
  it('future 态: 渲 dayLabel + tasks, 不显 ✓', () => {
    render(<PlanDay {...build()} />);
    const day = screen.getByTestId('plan-day');
    expect(day).toHaveAttribute('data-status', 'future');
    expect(day).toHaveAttribute('data-date', '2026-05-05');
    expect(screen.getByTestId('plan-day-label')).toHaveTextContent('M · 5');
    expect(screen.queryByTestId('plan-day-done-mark')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-item-t1')).toHaveTextContent('资料 · 增长率');
  });

  it('done 态: 渲 ✓ 标志', () => {
    render(<PlanDay {...build({ status: 'done' })} />);
    expect(screen.getByTestId('plan-day-done-mark')).toBeInTheDocument();
  });

  it('today 态: status attr=today, 视觉上 border 加粗 (data-status assertion)', () => {
    render(<PlanDay {...build({ status: 'today' })} />);
    const day = screen.getByTestId('plan-day');
    expect(day).toHaveAttribute('data-status', 'today');
    // 加粗 border 是 visual class, 不在 testing 范围, 保 status attr 即可.
  });

  it('missed 态: status=missed', () => {
    render(<PlanDay {...build({ status: 'missed' })} />);
    expect(screen.getByTestId('plan-day')).toHaveAttribute(
      'data-status',
      'missed',
    );
  });

  it('item.acc tone: data-tone=acc', () => {
    render(
      <PlanDay
        {...build({
          tasks: [
            {
              id: 't-acc',
              title: '资料 · 基期还原',
              tone: 'acc',
              clickable: true,
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId('plan-item-t-acc')).toHaveAttribute(
      'data-tone',
      'acc',
    );
  });

  it('clickable=true + onTaskClick → 点击触发 callback w/ task.id', async () => {
    const user = userEvent.setup();
    const onTaskClick = vi.fn();
    render(<PlanDay {...build()} onTaskClick={onTaskClick} />);
    await user.click(screen.getByTestId('plan-item-t1'));
    expect(onTaskClick).toHaveBeenCalledWith('t1');
  });

  it('clickable=false → 渲 div 不是 button', () => {
    render(
      <PlanDay
        {...build({
          tasks: [
            { id: 't-ro', title: '休息', tone: 'normal', clickable: false },
          ],
        })}
      />,
    );
    expect(screen.getByTestId('plan-item-t-ro').tagName).toBe('DIV');
  });

  it('clickable=true + 无 onTaskClick → 退化 div (防 undefined 调用)', () => {
    render(<PlanDay {...build()} />);
    expect(screen.getByTestId('plan-item-t1').tagName).toBe('DIV');
  });
});
