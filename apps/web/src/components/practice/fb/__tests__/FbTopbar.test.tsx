import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbTopbar } from '../FbTopbar';

describe('FbTopbar', () => {
  const baseProps = {
    paperName: '2024 国考 行测',
    timerDisplay: '12:34',
    isPaused: false,
    progressLabel: '5 / 35',
    onTogglePause: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  it('renders paper name + timer + progress', () => {
    render(<FbTopbar {...baseProps} />);
    expect(screen.getByText('2024 国考 行测')).toBeInTheDocument();
    expect(screen.getByTestId('fb-topbar-timer')).toHaveTextContent('12:34');
    expect(screen.getByTestId('fb-topbar-progress')).toHaveTextContent('5 / 35');
  });

  // Wave 4 Phase 2A 改造: dock + submit 下沉 FbBottomDock, topbar 只保留 pause + settings.
  it('renders 2 right-side toolbar items (pause / settings) — Wave 4 改造', () => {
    render(<FbTopbar {...baseProps} />);
    expect(screen.getByTestId('fb-topbar-pause')).toBeInTheDocument();
    expect(screen.getByTestId('fb-topbar-settings')).toBeInTheDocument();
    // dock + submit 已下沉 FbBottomDock.
    expect(screen.queryByTestId('fb-topbar-dock')).toBeNull();
    expect(screen.queryByTestId('fb-topbar-submit')).toBeNull();
  });

  it('clicking pause fires onTogglePause', async () => {
    const onTogglePause = vi.fn();
    const user = userEvent.setup();
    render(<FbTopbar {...baseProps} onTogglePause={onTogglePause} />);
    await user.click(screen.getByTestId('fb-topbar-pause'));
    expect(onTogglePause).toHaveBeenCalled();
  });

  it('paused state renders aria-label="继续" + dashed underline class', () => {
    render(<FbTopbar {...baseProps} isPaused />);
    expect(screen.getByTestId('fb-topbar-pause')).toHaveAttribute(
      'aria-label',
      '继续',
    );
    expect(screen.getByTestId('fb-topbar-timer')).toHaveAttribute(
      'data-paused',
      'true',
    );
  });

  it('settings IconBtn has aria-haspopup="dialog" + aria-controls="fb-settings-popover"', () => {
    render(<FbTopbar {...baseProps} />);
    const settings = screen.getByTestId('fb-topbar-settings');
    expect(settings).toHaveAttribute('aria-haspopup', 'dialog');
    expect(settings).toHaveAttribute('aria-controls', 'fb-settings-popover');
  });

  it('settings IconBtn aria-expanded reflects settingsOpen prop', () => {
    const { rerender } = render(<FbTopbar {...baseProps} settingsOpen={false} />);
    expect(screen.getByTestId('fb-topbar-settings')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    rerender(<FbTopbar {...baseProps} settingsOpen />);
    expect(screen.getByTestId('fb-topbar-settings')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
