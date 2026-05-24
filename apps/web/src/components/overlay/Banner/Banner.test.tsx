import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Banner } from './Banner';

describe('Banner', () => {
  it('uses role="alert" for variant="err"', () => {
    render(<Banner variant="err" title="出错了" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses role="status" for non-err variants', () => {
    const { rerender } = render(<Banner variant="info" title="提示" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<Banner variant="ok" title="OK" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<Banner variant="warn" title="注意" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the dismiss button when dismissible=true and triggers onDismiss', () => {
    const onDismiss = vi.fn();
    render(<Banner variant="warn" title="保存提醒" dismissible onDismiss={onDismiss} />);
    const x = screen.getByTestId('banner-dismiss');
    fireEvent.click(x);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders an action button and triggers its onClick', () => {
    const onClick = vi.fn();
    render(
      <Banner
        variant="info"
        title="新版本"
        action={{ label: '刷新', onClick }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders title and description text', () => {
    render(<Banner variant="info" title="标题" description="详细描述" />);
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByText('详细描述')).toBeInTheDocument();
  });
});
