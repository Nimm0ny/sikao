import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { KeyboardShortcuts } from './KeyboardShortcuts';

function dispatch(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent('keydown', init));
}

describe('KeyboardShortcuts', () => {
  it('invokes handler when modifiers + trigger key match (Ctrl+\\)', () => {
    const handler = vi.fn();
    render(
      <KeyboardShortcuts
        shortcuts={[
          { keys: ['Control', 'Backslash'], handler, description: 'toggle rail' },
        ]}
      />,
    );
    dispatch({ key: '\\', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire when modifiers do not match', () => {
    const handler = vi.fn();
    render(
      <KeyboardShortcuts
        shortcuts={[{ keys: ['Control', 'K'], handler, description: 'open palette' }]}
      />,
    );
    // wrong modifier (Meta instead of Ctrl)
    dispatch({ key: 'k', metaKey: true });
    // right key without modifier
    dispatch({ key: 'k' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = render(
      <KeyboardShortcuts shortcuts={[{ keys: ['n'], handler, description: 'new note' }]} />,
    );
    dispatch({ key: 'n' });
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
    dispatch({ key: 'n' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fail-fast on empty shortcuts array (no listener registered)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<KeyboardShortcuts shortcuts={[]} />);
    const keydownCalls = addSpy.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownCalls).toHaveLength(0);
    addSpy.mockRestore();
  });
});
