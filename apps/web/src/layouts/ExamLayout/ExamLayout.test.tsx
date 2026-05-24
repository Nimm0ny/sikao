import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExamLayout } from './ExamLayout';

describe('ExamLayout', () => {
  it('renders the 3 required slots (topbar / left / right)', () => {
    render(
      <ExamLayout
        topbar={<div>TopBar</div>}
        leftPane={<div>Material</div>}
        rightPane={<div>Question</div>}
      />,
    );
    expect(screen.getByTestId('exam-layout-topbar').textContent).toBe('TopBar');
    expect(screen.getByTestId('exam-layout-left-pane').textContent).toBe(
      'Material',
    );
    expect(screen.getByTestId('exam-layout-right-pane').textContent).toBe(
      'Question',
    );
  });

  it('renders the optional sheet slot only when sheet is provided', () => {
    const { unmount } = render(
      <ExamLayout
        topbar={<div>TopBar</div>}
        leftPane={<div>L</div>}
        rightPane={<div>R</div>}
      />,
    );
    expect(screen.queryByTestId('exam-layout-sheet')).toBeNull();
    unmount();
    render(
      <ExamLayout
        topbar={<div>TopBar</div>}
        leftPane={<div>L</div>}
        rightPane={<div>R</div>}
        sheet={<div>ScratchPad</div>}
      />,
    );
    expect(screen.getByTestId('exam-layout-sheet').textContent).toBe('ScratchPad');
  });

  it('exposes ResizeHandle as a separator role', () => {
    render(
      <ExamLayout
        topbar={<div>T</div>}
        leftPane={<div>L</div>}
        rightPane={<div>R</div>}
      />,
    );
    const handle = screen.getByTestId('exam-layout-resize-handle');
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('does NOT nest AppShell / Rail (D.3.35 gotcha)', () => {
    const { container } = render(
      <ExamLayout
        topbar={<div>T</div>}
        leftPane={<div>L</div>}
        rightPane={<div>R</div>}
      />,
    );
    // AppShell / Rail are layout-layer components with these data-testids.
    // ExamLayout MUST never render them as part of its skeleton.
    expect(container.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(container.querySelector('[data-testid="rail"]')).toBeNull();
  });

  it('panel group declares horizontal direction for the 2-pane split', () => {
    render(
      <ExamLayout
        topbar={<div>T</div>}
        leftPane={<div>L</div>}
        rightPane={<div>R</div>}
      />,
    );
    expect(
      screen.getByTestId('exam-layout-panel-group').dataset.direction,
    ).toBe('horizontal');
  });
});
