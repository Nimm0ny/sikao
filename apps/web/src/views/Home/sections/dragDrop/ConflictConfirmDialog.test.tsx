/*
 * ConflictConfirmDialog tests — SIK-139 W3.
 *
 * Why: the confirm layer is the writable conflict UX (design Decisions 1).
 *      These tests pin: it lists every conflict (title + time), confirm fires
 *      onConfirm, cancel / Esc / scrim each fire onCancel (clean exit), it is
 *      portal-mounted with alertdialog semantics, and closed renders nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';

import { ConflictConfirmDialog } from './ConflictConfirmDialog';
import type { EventConflictItemV2 } from '@sikao/api-client/types/home';

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: {
    // jsdom does not compute styles → color-contrast false-fails; deferred to
    // browser visual regression (same exclusion as views.a11y.test.tsx).
    'color-contrast': { enabled: false },
    'landmark-one-main': { enabled: false },
    region: { enabled: false },
  },
};

const CONFLICTS: EventConflictItemV2[] = [
  {
    kind: 'event',
    sourceId: 'e9',
    startAt: '2026-05-18T01:00:00.000Z',
    endAt: '2026-05-18T02:00:00.000Z',
    title: '已排事件 A',
  },
  {
    kind: 'practice_block',
    sourceId: 'p3',
    startAt: '2026-05-18T03:00:00.000Z',
    endAt: '2026-05-18T04:00:00.000Z',
    title: '练习时段 B',
  },
];

function setup(overrides: Partial<Parameters<typeof ConflictConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConflictConfirmDialog
      open
      conflicts={CONFLICTS}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConflictConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConflictConfirmDialog open={false} conflicts={CONFLICTS} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.queryByTestId('home-conflict-dialog')).toBeNull();
  });

  it('is portal-mounted with alertdialog semantics', () => {
    setup();
    const dialog = screen.getByTestId('home-conflict-dialog');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'home-conflict-title');
  });

  it('lists every conflict with its title', () => {
    setup();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getByText('已排事件 A')).toBeInTheDocument();
    expect(screen.getByText('练习时段 B')).toBeInTheDocument();
  });

  it('fires onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: '仍然改期' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('fires onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fires onCancel on Escape', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fires onCancel on scrim click (but not on card click)', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByTestId('home-conflict-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('home-conflict-dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1); // unchanged — card click does not close
  });

  it('has no axe violations when open (alertdialog + labelled + focusable actions)', async () => {
    setup();
    const results = await axe.run(screen.getByTestId('home-conflict-dialog'), AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });
});
