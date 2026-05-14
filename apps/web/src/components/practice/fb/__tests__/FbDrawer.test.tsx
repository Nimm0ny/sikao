import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbDrawer, FbDrawerGrid, FbDrawerSubmitFooter } from '../FbDrawer';

describe('FbDrawer', () => {
  it('renders nothing when open=false', () => {
    render(
      <FbDrawer open={false} onClose={vi.fn()}>
        body
      </FbDrawer>,
    );
    expect(screen.queryByTestId('fb-dock-panel')).not.toBeInTheDocument();
  });

  it('renders panel + scrim when open=true', () => {
    render(
      <FbDrawer open={true} onClose={vi.fn()}>
        body
      </FbDrawer>,
    );
    expect(screen.getByTestId('fb-dock-panel')).toBeInTheDocument();
    expect(screen.getByTestId('fb-dock-scrim')).toBeInTheDocument();
  });

  it('clicking scrim triggers onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <FbDrawer open={true} onClose={onClose}>
        body
      </FbDrawer>,
    );
    await user.click(screen.getByTestId('fb-dock-scrim'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking close button triggers onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <FbDrawer open={true} onClose={onClose}>
        body
      </FbDrawer>,
    );
    await user.click(screen.getByTestId('fb-dock-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders title default 答题卡', () => {
    render(
      <FbDrawer open={true} onClose={vi.fn()}>
        body
      </FbDrawer>,
    );
    expect(screen.getByText('答题卡')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(
      <FbDrawer open={true} onClose={vi.fn()} title="测试 drawer">
        body
      </FbDrawer>,
    );
    expect(screen.getByText('测试 drawer')).toBeInTheDocument();
  });
});

describe('FbDrawerGrid', () => {
  it('uses grid-cols-7 by default', () => {
    render(
      <FbDrawerGrid>
        <span>x</span>
      </FbDrawerGrid>,
    );
    expect(screen.getByTestId('fb-dock-grid').className).toContain('grid-cols-7');
  });

  it('accepts cols=5', () => {
    render(
      <FbDrawerGrid cols={5}>
        <span>x</span>
      </FbDrawerGrid>,
    );
    expect(screen.getByTestId('fb-dock-grid').className).toContain('grid-cols-5');
  });
});

describe('FbDrawerSubmitFooter', () => {
  it('renders unanswered + marked counts', () => {
    render(
      <FbDrawerSubmitFooter
        unansweredCount={13}
        markedCount={4}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByText('13 题')).toBeInTheDocument();
    expect(screen.getByText('4 题')).toBeInTheDocument();
  });

  it('clicking submit fires onSubmit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FbDrawerSubmitFooter
        unansweredCount={5}
        markedCount={1}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );
    await user.click(screen.getByTestId('fb-dock-submit'));
    expect(onSubmit).toHaveBeenCalled();
  });
});
