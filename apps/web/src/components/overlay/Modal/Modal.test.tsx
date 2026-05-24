import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

/*
 * Modal tests — V5 D.3.6 overlay.
 * Why: cover open / closed render, role+aria-modal a11y wiring, Esc + overlay
 *      click close paths, body scroll lock, and primary/secondary action
 *      callbacks. Portal target is document.body so the queries run against
 *      the testing-library default container which mounts inside body too.
 */

const baseAction = { label: '确定', onClick: () => {} };

describe('Modal', () => {
  it('renders nothing when open=false and a portal dialog when open=true', () => {
    const { rerender } = render(
      <Modal
        open={false}
        onClose={() => {}}
        title="标题"
        primaryAction={baseAction}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <Modal
        open={true}
        onClose={() => {}}
        title="标题"
        description="详细描述"
        primaryAction={baseAction}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Title + description are inside the portal node, parented to body.
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByText('详细描述')).toBeInTheDocument();
    // overlay sits at document.body level (portal contract)
    expect(screen.getByTestId('modal-overlay').parentElement).toBe(document.body);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="t" primaryAction={baseAction} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on overlay click when closeOnOverlay=true (default), inert when false', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} title="t" primaryAction={baseAction} />,
    );
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(
      <Modal
        open
        onClose={onClose}
        title="t"
        primaryAction={baseAction}
        closeOnOverlay={false}
      />,
    );
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks body scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto';
    const { rerender, unmount } = render(
      <Modal open onClose={() => {}} title="t" primaryAction={baseAction} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal open={false} onClose={() => {}} title="t" primaryAction={baseAction} />,
    );
    expect(document.body.style.overflow).toBe('auto');
    unmount();
  });

  it('invokes primary and secondary action callbacks on click; respects danger variant', () => {
    const primaryClick = vi.fn();
    const secondaryClick = vi.fn();
    render(
      <Modal
        open
        onClose={() => {}}
        title="确认删除"
        primaryAction={{ label: '删除', onClick: primaryClick, variant: 'danger' }}
        secondaryAction={{ label: '取消', onClick: secondaryClick }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(primaryClick).toHaveBeenCalledTimes(1);
    expect(secondaryClick).toHaveBeenCalledTimes(1);
    // danger primary should attach data-variant="danger" via Button atom
    expect(screen.getByRole('button', { name: '删除' })).toHaveAttribute('data-variant', 'danger');
  });
});
