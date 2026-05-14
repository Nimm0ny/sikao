import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberCircle } from '../composite/NumberCircle';

describe('NumberCircle', () => {
  it('renders number content + status data attribute', () => {
    render(
      <NumberCircle number={22} status="answered" ariaLabel="第 22 题, 已答" />,
    );
    const wrapper = screen.getByRole('img', { name: '第 22 题, 已答' });
    expect(wrapper).toHaveAttribute('data-status', 'answered');
    expect(wrapper).toHaveTextContent('22');
  });

  it('forwards ariaLabel to onClick=button variant', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <NumberCircle
        number={1}
        status="unanswered"
        ariaLabel="第 1 题, 未答, 点击跳转"
        onClick={onClick}
      />,
    );
    const btn = screen.getByRole('button', { name: '第 1 题, 未答, 点击跳转' });
    expect(btn).toHaveAttribute('data-status', 'unanswered');
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marked status renders accent stroke (no fill)', () => {
    render(<NumberCircle number={3} status="marked" ariaLabel="第 3 题, 标记" />);
    const wrapper = screen.getByRole('img', { name: '第 3 题, 标记' });
    const circles = wrapper.querySelectorAll('circle');
    // 1 stroked circle (outer), no fill circle
    expect(circles.length).toBe(1);
    expect(circles[0]?.getAttribute('stroke')).toBe('var(--accent-1)');
  });

  it('current=true adds halo ring', () => {
    render(
      <NumberCircle
        number={5}
        status="current"
        current
        ariaLabel="第 5 题, 当前"
      />,
    );
    const wrapper = screen.getByRole('img', { name: '第 5 题, 当前' });
    const circles = wrapper.querySelectorAll('circle');
    // current = filled main circle + halo (r=11.5)
    expect(circles.length).toBe(2);
    const halo = circles[1];
    expect(halo?.getAttribute('r')).toBe('11.5');
    expect(halo?.getAttribute('stroke-opacity')).toBe('0.3');
  });

  it('size sm/md/lg maps to 24/28/32 px', () => {
    const { rerender } = render(
      <NumberCircle number={1} status="unanswered" size="sm" ariaLabel="x" />,
    );
    let svg = screen.getByRole('img').querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');

    rerender(
      <NumberCircle number={1} status="unanswered" size="md" ariaLabel="x" />,
    );
    svg = screen.getByRole('img').querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('28');

    rerender(
      <NumberCircle number={1} status="unanswered" size="lg" ariaLabel="x" />,
    );
    svg = screen.getByRole('img').querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
  });

  it('letter (A/B/C/D) renders as number content', () => {
    render(<NumberCircle number="B" status="current" ariaLabel="选项 B" />);
    expect(screen.getByRole('img', { name: '选项 B' })).toHaveTextContent('B');
  });

  it('wrong status uses bad-bg fill + bad number color', () => {
    render(<NumberCircle number={9} status="wrong" ariaLabel="第 9 题, 错" />);
    const wrapper = screen.getByRole('img', { name: '第 9 题, 错' });
    const fillCircle = wrapper.querySelector('circle[fill="var(--bad-bg)"]');
    expect(fillCircle).not.toBeNull();
    const text = wrapper.querySelector('text');
    expect(text?.getAttribute('fill')).toBe('var(--err)');
  });
});
