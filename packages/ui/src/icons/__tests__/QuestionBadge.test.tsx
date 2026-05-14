import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionBadge } from '../composite/QuestionBadge';

describe('QuestionBadge', () => {
  it('writing status renders SVG-only button with progress visual', () => {
    render(
      <QuestionBadge
        index={3}
        status="writing"
        current={142}
        required={500}
        ariaLabel="问题 3, 正在作答, 142/500"
      />,
    );
    const btn = screen.getByRole('button', {
      name: '问题 3, 正在作答, 142/500',
    });
    expect(btn).toHaveAttribute('data-status', 'writing');
    expect(btn).toHaveAccessibleName('问题 3, 正在作答, 142/500');
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('svg')).not.toBeNull();
    expect(btn.querySelector('path[stroke-dasharray]')).not.toBeNull();
  });

  it('submitted status shows check svg without button text', () => {
    render(
      <QuestionBadge
        index={1}
        status="submitted"
        current={198}
        required={200}
        ariaLabel="问题 1, 已提交"
      />,
    );
    const btn = screen.getByRole('button', { name: '问题 1, 已提交' });
    expect(btn.textContent).toBe('');
    const checkPath = btn.querySelector('svg path');
    expect(checkPath).not.toBeNull();
    expect(checkPath?.getAttribute('d')).toBe('M8 10.5l4.5 4.5L24 5');
  });

  it('locked status renders lock svg and disables click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <QuestionBadge
        index={4}
        status="locked"
        current={0}
        required={1000}
        ariaLabel="问题 4, 未解锁"
        onClick={onClick}
      />,
    );
    const btn = screen.getByRole('button', { name: '问题 4, 未解锁' });
    expect(btn).toHaveAttribute('data-status', 'locked');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('svg rect')).not.toBeNull();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('pending status shows progress visual without text', () => {
    render(
      <QuestionBadge
        index={2}
        status="pending"
        current={0}
        required={300}
        ariaLabel="问题 2, 待作答"
      />,
    );
    const btn = screen.getByRole('button', { name: '问题 2, 待作答' });
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('circle')).not.toBeNull();
    expect(btn.querySelector('path[stroke-dasharray]')).not.toBeNull();
  });

  it('required=0 keeps word count in aria-label only', () => {
    render(
      <QuestionBadge
        index={5}
        status="writing"
        current={120}
        required={0}
        ariaLabel="问题 5, 正在作答, 120 字"
      />,
    );
    const btn = screen.getByRole('button', { name: '问题 5, 正在作答, 120 字' });
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('path[stroke-dasharray="0 1"]')).not.toBeNull();
  });

  it('without current/required renders no progress path', () => {
    render(<QuestionBadge index={1} status="pending" ariaLabel="问题 1" />);
    const btn = screen.getByRole('button', { name: '问题 1' });
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('path[stroke-dasharray]')).toBeNull();
  });

  it('writing status fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <QuestionBadge
        index={1}
        status="writing"
        current={50}
        required={200}
        ariaLabel="问题 1, 正在作答"
        onClick={onClick}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
