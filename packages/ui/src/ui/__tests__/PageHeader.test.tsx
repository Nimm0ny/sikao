import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders title as h1 with text-3xl token', () => {
    render(<PageHeader title="个人中心" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('个人中心');
    expect(h1).toHaveClass('text-3xl', 'font-bold', 'text-ink');
  });

  it('omits eyebrow span when not provided', () => {
    render(<PageHeader title="x" />);
    const header = screen.getByTestId('page-header');
    // 没 eyebrow 时不应有 text-tiny span 子节点
    expect(header.querySelector('.text-tiny')).toBeNull();
  });

  it('renders eyebrow above title when provided', () => {
    render(<PageHeader eyebrow="History · 思考" title="申论真题" />);
    const eyebrow = screen.getByText('History · 思考');
    expect(eyebrow).toHaveClass('text-tiny', 'text-ink-3');
    // eyebrow 在 h1 之前
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(eyebrow.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders subtitle paragraph when provided', () => {
    render(<PageHeader title="x" subtitle="副标题文本" />);
    const p = screen.getByText('副标题文本');
    expect(p.tagName).toBe('P');
    expect(p).toHaveClass('text-sm', 'text-ink-3');
  });

  it('omits subtitle paragraph when not provided', () => {
    render(<PageHeader title="x" />);
    const header = screen.getByTestId('page-header');
    expect(header.querySelector('p')).toBeNull();
  });

  it('renders actions in right slot, click delegates', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PageHeader
        title="x"
        actions={<button onClick={onClick}>返回</button>}
      />,
    );
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders children below title', () => {
    render(
      <PageHeader title="x">
        <div data-testid="extra-slot">进入考场</div>
      </PageHeader>,
    );
    const child = screen.getByTestId('extra-slot');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(child.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('supports ReactNode title with rich content', () => {
    render(
      <PageHeader
        title={
          <>
            申论真题<span className="font-serif"> 练笔</span>
          </>
        }
      />,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('申论真题 练笔');
    expect(h1.querySelector('.font-serif')).not.toBeNull();
  });

  it('default testId is page-header', () => {
    render(<PageHeader title="x" />);
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('overrides testId via prop', () => {
    render(<PageHeader title="x" testId="profile-header" />);
    expect(screen.getByTestId('profile-header')).toBeInTheDocument();
    expect(screen.queryByTestId('page-header')).toBeNull();
  });

  it('applies className override on header element', () => {
    render(<PageHeader title="x" className="mt-12" />);
    expect(screen.getByTestId('page-header')).toHaveClass('mt-12', 'space-y-2');
  });
});
