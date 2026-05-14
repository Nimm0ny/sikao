import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbScratchFab } from '../FbScratchFab';

describe('FbScratchFab', () => {
  it('renders nothing when visible=false', () => {
    render(<FbScratchFab visible={false} clipCount={0} onClick={vi.fn()} />);
    expect(screen.queryByTestId('fb-scratch-fab')).not.toBeInTheDocument();
  });

  it('renders FAB when visible=true', () => {
    render(<FbScratchFab visible={true} clipCount={0} onClick={vi.fn()} />);
    expect(screen.getByTestId('fb-scratch-fab')).toBeInTheDocument();
  });

  it('renders count badge when clipCount > 0', () => {
    render(<FbScratchFab visible={true} clipCount={3} onClick={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides count badge when clipCount = 0', () => {
    render(<FbScratchFab visible={true} clipCount={0} onClick={vi.fn()} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('clicking FAB triggers onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<FbScratchFab visible={true} clipCount={0} onClick={onClick} />);
    await user.click(screen.getByTestId('fb-scratch-fab'));
    expect(onClick).toHaveBeenCalled();
  });

  it('aria-label includes count when clipCount > 0', () => {
    render(<FbScratchFab visible={true} clipCount={3} onClick={vi.fn()} />);
    const fab = screen.getByTestId('fb-scratch-fab');
    expect(fab).toHaveAttribute('aria-label', '打开便签 (已有 3 条)');
  });
});
