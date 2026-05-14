import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CiteBar } from '../CiteBar';
import type { Citation } from '@sikao/domain/shenlun/types';

const cites: Citation[] = [
  { id: 'c1', text: 'foo', sourceLabel: 'M1·段一', insertedAt: 0 },
  { id: 'c2', text: 'bar', sourceLabel: 'M2·段二', insertedAt: 0 },
];

describe('CiteBar', () => {
  it('renders nothing on empty list', () => {
    const { container } = render(
      <CiteBar citations={[]} onJump={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one chip per citation', () => {
    render(<CiteBar citations={cites} onJump={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByTestId('essay-cite-chip-c1')).toBeInTheDocument();
    expect(screen.getByTestId('essay-cite-chip-c2')).toBeInTheDocument();
  });

  it('jump button fires onJump(citation)', () => {
    const onJump = vi.fn();
    render(<CiteBar citations={cites} onJump={onJump} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('跳到引用源 M1·段一'));
    expect(onJump).toHaveBeenCalledWith(cites[0]);
  });

  it('remove button fires onRemove(citationId)', () => {
    const onRemove = vi.fn();
    render(<CiteBar citations={cites} onJump={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('移除引用：M2·段二'));
    expect(onRemove).toHaveBeenCalledWith('c2');
  });
});
