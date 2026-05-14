import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberSquare } from '../composite/NumberSquare';

describe('NumberSquare', () => {
  it('renders rect (rx=4) instead of circle for current state', () => {
    render(
      <NumberSquare number="B" status="current" ariaLabel="选项 B, 已选" />,
    );
    const wrapper = screen.getByRole('img', { name: '选项 B, 已选' });
    const rects = wrapper.querySelectorAll('rect');
    expect(rects.length).toBe(1);
    expect(rects[0]?.getAttribute('rx')).toBe('4');
    expect(rects[0]?.getAttribute('fill')).toBe('var(--accent-1)');
  });

  it('unanswered renders only stroked rect (no fill)', () => {
    render(<NumberSquare number="A" status="unanswered" ariaLabel="选项 A" />);
    const wrapper = screen.getByRole('img', { name: '选项 A' });
    const rects = wrapper.querySelectorAll('rect');
    expect(rects.length).toBe(1);
    expect(rects[0]?.getAttribute('stroke')).toBe('var(--ink-3)');
    expect(rects[0]?.getAttribute('fill')).toBe('none');
  });

  it('answered fills with ink, paper text', () => {
    render(<NumberSquare number={7} status="answered" ariaLabel="第 7, 已答" />);
    const wrapper = screen.getByRole('img', { name: '第 7, 已答' });
    const fillRect = wrapper.querySelector('rect[fill="var(--ink-1)"]');
    expect(fillRect).not.toBeNull();
    expect(wrapper.querySelector('text')?.getAttribute('fill')).toBe(
      'var(--paper-1)',
    );
  });

  it('onClick variant becomes a button with ariaLabel', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <NumberSquare
        number="C"
        status="unanswered"
        ariaLabel="选项 C, 点击选中"
        onClick={onClick}
      />,
    );
    const btn = screen.getByRole('button', { name: '选项 C, 点击选中' });
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('current=true adds halo rect', () => {
    render(
      <NumberSquare
        number={1}
        status="current"
        current
        ariaLabel="第 1 题, 当前"
      />,
    );
    const wrapper = screen.getByRole('img', { name: '第 1 题, 当前' });
    const rects = wrapper.querySelectorAll('rect');
    // 1 main filled + 1 halo
    expect(rects.length).toBe(2);
    const halo = rects[1];
    expect(halo?.getAttribute('stroke-opacity')).toBe('0.3');
  });
});
