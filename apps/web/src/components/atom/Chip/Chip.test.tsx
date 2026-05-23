import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chip } from './Chip';

describe('Chip', () => {
  it('shares Tag rendering — variant data attr propagates', () => {
    render(<Chip variant="info">已选</Chip>);
    const el = screen.getByText('已选').closest('[data-variant]') as HTMLElement;
    expect(el.dataset.variant).toBe('info');
  });

  it('fires onRemove when × is clicked', () => {
    const onRemove = vi.fn();
    render(
      <Chip variant="brand" onRemove={onRemove}>
        筛选
      </Chip>,
    );
    fireEvent.click(screen.getByTestId('tag-remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders without a remove button by default', () => {
    render(<Chip variant="ok">通过</Chip>);
    expect(screen.queryByTestId('tag-remove')).toBeNull();
  });
});
