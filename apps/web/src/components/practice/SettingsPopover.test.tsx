import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPopover } from './SettingsPopover';
import { useThemeStore } from '@/styles/useThemeStore';

describe('SettingsPopover', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-practice-font');
    useThemeStore.setState({ examTheme: 'light' });
  });
  afterEach(() => {
    document.documentElement.removeAttribute('data-practice-font');
  });

  it('toggles popover on click; default md selected', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);
    expect(screen.queryByTestId('settings-popover')).toBeNull();
    await user.click(screen.getByTestId('session-header-settings'));
    const panel = screen.getByTestId('settings-popover');
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId('font-size-md')).toHaveAttribute('aria-pressed', 'true');
  });

  it('selecting font-size lg writes localStorage and applies data-attr', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);
    await user.click(screen.getByTestId('session-header-settings'));
    await user.click(screen.getByTestId('font-size-lg'));
    expect(window.localStorage.getItem('sikao.practice.fontSize')).toBe('lg');
    expect(document.documentElement.getAttribute('data-practice-font')).toBe('lg');
  });

  it('Escape key closes popover', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);
    await user.click(screen.getByTestId('session-header-settings'));
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByTestId('settings-popover')).toBeNull();
  });

  it('dark toggle flips examTheme store and accessible label', async () => {
    const user = userEvent.setup();
    render(<SettingsPopover />);
    await user.click(screen.getByTestId('session-header-settings'));
    const toggle = screen.getByTestId('settings-toggle-dark');
    expect(toggle).toHaveAttribute('aria-label', '切到夜间');
    expect(toggle).not.toHaveAttribute('title');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.hover(toggle);
    expect(screen.getByRole('tooltip')).toHaveTextContent('切到夜间');
    await user.unhover(toggle);
    await user.click(toggle);
    expect(useThemeStore.getState().examTheme).toBe('dark');
    expect(toggle).toHaveAttribute('aria-label', '切到日间');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // review-fix #15c: 验证 zustand persist 把 examTheme 写到 localStorage
    const stored = window.localStorage.getItem('sikao.examTheme');
    expect(stored).not.toBeNull();
    expect(stored).toContain('"examTheme":"dark"');
  });

  it('outside pointerdown closes popover', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <SettingsPopover />
        <button data-testid="outside">outside</button>
      </div>,
    );
    await user.click(screen.getByTestId('session-header-settings'));
    expect(screen.getByTestId('settings-popover')).toBeInTheDocument();
    await act(async () => {
      const target = screen.getByTestId('outside');
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(screen.queryByTestId('settings-popover')).toBeNull();
  });
});
