import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Popover } from './Popover';

function Harness({ initialOpen = false, onChange }: { initialOpen?: boolean; onChange?: (v: boolean) => void }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          onChange?.(v);
        }}
        trigger={<button type="button">trigger</button>}
      >
        <span data-testid="panel-content">menu body</span>
      </Popover>
      <span data-testid="outside-area">outside</span>
    </div>
  );
}

describe('Popover', () => {
  it('renders panel content into document.body via portal when open', () => {
    render(<Harness initialOpen />);
    const panelContent = screen.getByTestId('panel-content');
    expect(panelContent).toBeInTheDocument();
    // Portal contract: the panel ancestry must reach document.body, NOT the
    // inline harness wrapper element. Walk up until we find data-popover-panel.
    let node: HTMLElement | null = panelContent;
    while (node && node.dataset.popoverPanel !== 'true') {
      node = node.parentElement;
    }
    expect(node).not.toBeNull();
    expect(node?.parentElement).toBe(document.body);
  });

  it('attaches aria-haspopup + aria-expanded onto the trigger', () => {
    render(<Harness initialOpen />);
    const trigger = screen.getByRole('button', { name: 'trigger' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onOpenChange(false) when clicking outside', () => {
    const onChange = vi.fn();
    render(<Harness initialOpen onChange={onChange} />);
    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
