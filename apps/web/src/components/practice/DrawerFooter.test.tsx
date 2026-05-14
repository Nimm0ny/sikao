import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { DrawerFooter } from './DrawerFooter';

// DrawerFooter is dumb. The label ("剩余" vs "当前用时") is decided by the
// caller; the footer only renders what it gets. This contract makes the
// label-vs-value mismatch (P0-4) impossible by construction.

function renderFooter(overrides: Partial<ComponentProps<typeof DrawerFooter>> = {}) {
  const onBackToCurrent = vi.fn();
  const onSubmit = vi.fn();
  render(
    <DrawerFooter
      unansweredCount={3}
      timerLabel="剩余"
      timerDisplay="1:54"
      onBackToCurrent={onBackToCurrent}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onBackToCurrent, onSubmit };
}

describe('DrawerFooter', () => {
  it('renders unanswered count', () => {
    renderFooter({ unansweredCount: 7 });
    expect(screen.getByTestId('drawer-footer')).toHaveTextContent('未答 7 题');
  });

  it('exam mode: label="剩余" pairs with countdown value', () => {
    renderFooter({ timerLabel: '剩余', timerDisplay: '1:54' });
    expect(screen.getByTestId('drawer-footer')).toHaveTextContent('剩余 1:54');
    expect(screen.getByTestId('drawer-footer')).not.toHaveTextContent('当前用时');
  });

  it('practice mode: label="当前用时" pairs with elapsed value', () => {
    renderFooter({ timerLabel: '当前用时', timerDisplay: '0:30' });
    expect(screen.getByTestId('drawer-footer')).toHaveTextContent('当前用时 0:30');
    expect(screen.getByTestId('drawer-footer')).not.toHaveTextContent('剩余');
  });

  it('back-to-current button triggers callback', async () => {
    const user = userEvent.setup();
    const { onBackToCurrent } = renderFooter();
    await user.click(screen.getByTestId('drawer-footer-back'));
    expect(onBackToCurrent).toHaveBeenCalledTimes(1);
  });

  it('submit button triggers callback', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFooter();
    await user.click(screen.getByTestId('drawer-footer-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submit button disabled while isSubmitting', () => {
    renderFooter({ isSubmitting: true });
    expect(screen.getByTestId('drawer-footer-submit')).toBeDisabled();
  });
});
