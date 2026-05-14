import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ScratchClip } from '../ScratchClip';
import { ESSAY_CLIP_MIME } from '@sikao/domain/shenlun/types';

const clip = {
  id: 'c1',
  matId: 'm1',
  start: 0,
  end: 4,
  text: '示例片段',
  sourceLabel: 'M1·段一',
  position: 0,
  addedAt: 0,
};

describe('ScratchClip', () => {
  it('renders text + source label', () => {
    render(<ScratchClip clip={clip} onRemove={vi.fn()} />);
    expect(screen.getByText('示例片段')).toBeInTheDocument();
    expect(screen.getByText('M1·段一')).toBeInTheDocument();
  });

  it('remove button calls onRemove(id)', () => {
    const onRemove = vi.fn();
    render(<ScratchClip clip={clip} onRemove={onRemove} />);
    fireEvent.click(screen.getByTestId('essay-scratch-clip-remove-c1'));
    expect(onRemove).toHaveBeenCalledWith('c1');
  });

  it('drag emits cite-style text/plain "《text》[label]"', () => {
    render(<ScratchClip clip={clip} onRemove={vi.fn()} />);
    const card = screen.getByTestId('essay-scratch-clip-c1');
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: vi.fn((t: string, v: string) => store.set(t, v)),
      effectAllowed: 'none',
      types: [],
    };
    fireEvent.dragStart(card, { dataTransfer });
    expect(store.get('text/plain')).toBe('《示例片段》[M1·段一]');
    expect(store.get(ESSAY_CLIP_MIME)).toBeDefined();
    const payload = JSON.parse(store.get(ESSAY_CLIP_MIME) ?? '') as unknown;
    expect(payload).toMatchObject({ clipId: 'c1' });
  });

  it('aria-label on remove uses preview text', () => {
    render(<ScratchClip clip={clip} onRemove={vi.fn()} />);
    expect(
      screen.getByLabelText(/删除草稿片段：示例片段/),
    ).toBeInTheDocument();
  });
});
