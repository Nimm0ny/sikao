import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MaterialPanel } from '../MaterialPanel';
import { ESSAY_CLIP_MIME } from '@sikao/domain/shenlun/types';
import type { Material } from '@sikao/domain/shenlun/types';

const material: Material = {
  id: 'm1',
  title: '资料一',
  subtitle: '关于工艺振兴',
  // Three paragraphs separated by \n.
  body: '第一段开头。\n第二段开头。\n第三段开头。',
};

describe('MaterialPanel', () => {
  it('renders material title + body', () => {
    render(<MaterialPanel material={material} matIndex={0} highlights={[]} />);
    expect(screen.getByText('资料一')).toBeInTheDocument();
    // The body itself is split into multiple text segments — assert by partial match.
    expect(screen.getByTestId('essay-material-panel-body')).toHaveTextContent(
      '第一段开头',
    );
  });

  it('wraps highlight ranges in MaterialClip with correct sourceLabel', () => {
    render(
      <MaterialPanel
        material={material}
        matIndex={1}
        highlights={[{ start: 8, end: 13 }]}
      />,
    );
    // start=8 is in 段二 (after the first \n at idx 6).
    const clip = screen.getByTestId('essay-material-clip-m1-8');
    expect(clip.getAttribute('data-source-label')).toBe('M2·段二');
  });

  it('multiple non-overlapping highlights produce multiple clips', () => {
    render(
      <MaterialPanel
        material={material}
        matIndex={0}
        highlights={[
          { start: 0, end: 3 },
          { start: 7, end: 10 },
        ]}
      />,
    );
    expect(screen.getByTestId('essay-material-clip-m1-0')).toBeInTheDocument();
    expect(screen.getByTestId('essay-material-clip-m1-7')).toBeInTheDocument();
  });

  it('overlapping highlights — keeps first, drops later overlap', () => {
    render(
      <MaterialPanel
        material={material}
        matIndex={0}
        highlights={[
          { start: 0, end: 5 },
          { start: 3, end: 8 }, // overlaps with first
        ]}
      />,
    );
    expect(screen.getByTestId('essay-material-clip-m1-0')).toBeInTheDocument();
    expect(
      screen.queryByTestId('essay-material-clip-m1-3'),
    ).not.toBeInTheDocument();
  });

  it('drag from MaterialClip emits payload with matId / sourceLabel', () => {
    render(
      <MaterialPanel
        material={material}
        matIndex={0}
        highlights={[{ start: 0, end: 5 }]}
      />,
    );
    const clip = screen.getByTestId('essay-material-clip-m1-0');
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: vi.fn((t: string, v: string) => store.set(t, v)),
      effectAllowed: 'none',
      types: [],
    };
    fireEvent.dragStart(clip, { dataTransfer });
    const payload = JSON.parse(store.get(ESSAY_CLIP_MIME) ?? '{}');
    expect(payload.matId).toBe('m1');
    expect(payload.sourceLabel).toBe('M1·段一');
  });
});
