import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title (always) and omits description when not given', () => {
    render(<EmptyState title="尚未上传资料" />);
    expect(screen.getByText('尚未上传资料')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <EmptyState
        title="搜索无结果"
        description="试试其他关键词或调整筛选条件"
        illustration="no-result"
      />,
    );
    expect(screen.getByText('试试其他关键词或调整筛选条件')).toBeInTheDocument();
  });

  it('renders the primary action button and triggers onClick', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="出错了"
        illustration="error"
        primaryAction={{ label: '重试', onClick }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
