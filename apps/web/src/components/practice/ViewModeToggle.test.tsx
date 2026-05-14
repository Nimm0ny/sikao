import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewModeToggle } from './ViewModeToggle';

describe('ViewModeToggle', () => {
  it('renders deck + scroll options with active state', () => {
    render(<ViewModeToggle value="deck" onChange={() => {}} />);
    expect(screen.getByTestId('view-mode-deck')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('view-mode-scroll')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking deck (when on scroll) calls onChange("deck")', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ViewModeToggle value="scroll" onChange={onChange} scrollDisabled={false} />);
    await user.click(screen.getByTestId('view-mode-deck'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('deck');
  });

  it('scroll option disabled by default — click does not fire', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ViewModeToggle value="deck" onChange={onChange} />);
    const scrollBtn = screen.getByTestId('view-mode-scroll');
    expect(scrollBtn).toBeDisabled();
    expect(scrollBtn).toHaveAttribute('aria-label', '滚动模式 · 即将上线');
    expect(scrollBtn).not.toHaveAttribute('title');
    await user.click(scrollBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('scroll option enabled when scrollDisabled=false', () => {
    render(<ViewModeToggle value="deck" onChange={() => {}} scrollDisabled={false} />);
    expect(screen.getByTestId('view-mode-scroll')).not.toBeDisabled();
  });
});
