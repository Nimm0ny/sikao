import { describe, it, expect } from 'vitest';
import { createRef, useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusTrap } from './FocusTrap';

describe('FocusTrap', () => {
  it('focuses the first focusable child when active and wraps Tab back to start', async () => {
    const user = userEvent.setup();
    render(
      <FocusTrap active>
        <button type="button">first</button>
        <button type="button">second</button>
      </FocusTrap>,
    );

    const first = screen.getByRole('button', { name: 'first' });
    const second = screen.getByRole('button', { name: 'second' });
    expect(first).toHaveFocus();

    await user.tab();
    expect(second).toHaveFocus();

    // Tab from last focusable should wrap back to first (trapped inside container).
    await user.tab();
    expect(first).toHaveFocus();

    // Shift+Tab from first should wrap to last.
    await user.tab({ shift: true });
    expect(second).toHaveFocus();
  });

  it('honors initialFocus ref when provided', () => {
    function Harness() {
      const ref = useRef<HTMLButtonElement | null>(null);
      return (
        <FocusTrap active initialFocus={ref}>
          <button type="button">first</button>
          <button type="button" ref={ref}>
            target
          </button>
        </FocusTrap>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'target' })).toHaveFocus();
  });

  it('restores focus to previously focused element on unmount when returnFocus is true', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'opener';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const ref = createRef<HTMLDivElement>();
    const { unmount } = render(
      <div ref={ref}>
        <FocusTrap active>
          <button type="button">inside</button>
        </FocusTrap>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'inside' })).toHaveFocus();

    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
