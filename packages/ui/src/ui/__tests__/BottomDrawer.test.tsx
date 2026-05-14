import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomDrawer } from '../BottomDrawer';

describe('BottomDrawer', () => {
  it('omits focusable drawer content while closed', () => {
    render(
      <BottomDrawer
        open={false}
        onToggle={vi.fn()}
        header={<button type="button">关闭</button>}
        footer={<button type="button">交卷</button>}
      >
        <button type="button">题号 1</button>
      </BottomDrawer>,
    );

    expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '交卷' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '题号 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开抽屉' })).toBeInTheDocument();
  });

  it('renders header body and footer while open', () => {
    render(
      <BottomDrawer
        open
        onToggle={vi.fn()}
        header={<button type="button">关闭</button>}
        footer={<button type="button">交卷</button>}
      >
        <button type="button">题号 1</button>
      </BottomDrawer>,
    );

    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '交卷' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '题号 1' })).toBeInTheDocument();
  });
});
