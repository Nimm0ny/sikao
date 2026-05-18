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
    onExit: vi.fn(),
    onTogglePause: vi.fn(),
    onOpenSettings: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('renders paper name + timer + progress', () => {
    render(<FbTopbar {...baseProps} />);
    expect(screen.getByText('2024 国考 行测')).toBeInTheDocument();
    expect(screen.getByTestId('fb-topbar-timer')).toHaveTextContent('12:34');
    expect(screen.getByTestId('fb-topbar-progress')).toHaveTextContent('5 / 35');
  });

  it('renders prototype-style back, pause, settings, and submit controls', () => {
    render(<FbTopbar {...baseProps} />);
    expect(screen.getByTestId('fb-topbar-back')).toBeInTheDocument();
    expect(screen.getByTestId('fb-topbar-pause')).toBeInTheDocument();
    expect(screen.getByTestId('fb-topbar-settings')).toBeInTheDocument();
    expect(screen.getByTestId('fb-topbar-submit')).toBeInTheDocument();
    expect(screen.queryByTestId('fb-topbar-dock')).toBeNull();
  });

  it('clicking pause fires onTogglePause', async () => {
    const onTogglePause = vi.fn();
    const user = userEvent.setup();
    render(<FbTopbar {...baseProps} onTogglePause={onTogglePause} />);
    await user.click(screen.getByTestId('fb-topbar-pause'));
    expect(onTogglePause).toHaveBeenCalled();
  });

  it('clicking back, settings, and submit fire their handlers', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    const onOpenSettings = vi.fn();
    const onSubmit = vi.fn();
    render(
      <FbTopbar
        {...baseProps}
        onExit={onExit}
        onOpenSettings={onOpenSettings}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByTestId('fb-topbar-back'));
    await user.click(screen.getByTestId('fb-topbar-settings'));
    await user.click(screen.getByTestId('fb-topbar-submit'));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
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
