import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tag } from './Tag';

describe('Tag', () => {
  it('renders the close affordance only when `onRemove` is provided', () => {
    const { rerender } = render(<Tag variant="brand">资料</Tag>);
    expect(screen.queryByTestId('tag-remove')).toBeNull();

    rerender(
      <Tag variant="brand" onRemove={() => {}}>
        资料
      </Tag>,
    );
    expect(screen.getByTestId('tag-remove')).toBeInTheDocument();
  });

  it('triggers `onRemove` when the close button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <Tag variant="info" onRemove={onRemove}>
        话题
      </Tag>,
    );
    fireEvent.click(screen.getByTestId('tag-remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('forwards variant/size to underlying Badge', () => {
    render(
      <Tag variant="cat-shuliang" size="sm">
        数量
      </Tag>,
    );
    const badge = screen.getByText('数量').closest('[data-variant]') as HTMLElement;
    expect(badge.dataset.variant).toBe('cat-shuliang');
    expect(badge.dataset.size).toBe('sm');
  });
});
