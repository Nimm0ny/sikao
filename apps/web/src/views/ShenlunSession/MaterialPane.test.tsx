import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import MaterialPane from './MaterialPane';
import type { ShenlunMaterial } from './mockSession';

// MaterialPane tests (PR13 P2, 2026-05-13).
//
// 覆盖:
//   - 渲染 required props 不崩
//   - chip 数量 = materials 长度
//   - activeId chip 高亮 (data-active="true" / aria-pressed)
//   - 点 chip 触发 onActiveChange(id)
//   - 当前 material 内容渲染在 reader 区
//   - activeId 不在 materials 中 → throw (fail-fast)

const M: ReadonlyArray<ShenlunMaterial> = [
  { id: 'a', title: '材料一', content: '第一段内容' },
  { id: 'b', title: '材料二', content: '第二段内容' },
  { id: 'c', title: '材料三', content: '第三段内容' },
];

describe('MaterialPane', () => {
  it('renders without crashing with required props', () => {
    renderWithProviders(
      <MaterialPane materials={M} activeId="a" onActiveChange={vi.fn()} />,
    );
    expect(screen.getByTestId('shenlun-material-pane')).toBeInTheDocument();
  });

  it('renders one chip per material', () => {
    renderWithProviders(
      <MaterialPane materials={M} activeId="a" onActiveChange={vi.fn()} />,
    );
    expect(screen.getByTestId('shenlun-material-chip-a')).toBeInTheDocument();
    expect(screen.getByTestId('shenlun-material-chip-b')).toBeInTheDocument();
    expect(screen.getByTestId('shenlun-material-chip-c')).toBeInTheDocument();
  });

  it('highlights the active chip via data-active + aria-pressed', () => {
    renderWithProviders(
      <MaterialPane materials={M} activeId="b" onActiveChange={vi.fn()} />,
    );
    const a = screen.getByTestId('shenlun-material-chip-a');
    const b = screen.getByTestId('shenlun-material-chip-b');
    expect(b.getAttribute('data-active')).toBe('true');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(a.getAttribute('data-active')).toBeNull();
    expect(a.getAttribute('aria-pressed')).toBe('false');
  });

  it('fires onActiveChange with id when a chip is clicked', () => {
    const onActiveChange = vi.fn();
    renderWithProviders(
      <MaterialPane materials={M} activeId="a" onActiveChange={onActiveChange} />,
    );
    fireEvent.click(screen.getByTestId('shenlun-material-chip-c'));
    expect(onActiveChange).toHaveBeenCalledWith('c');
  });

  it('renders the active material content in the reader', () => {
    renderWithProviders(
      <MaterialPane materials={M} activeId="b" onActiveChange={vi.fn()} />,
    );
    const reader = screen.getByTestId('shenlun-material-reader');
    expect(reader.getAttribute('data-material-id')).toBe('b');
    expect(screen.getByTestId('shenlun-material-reader-body')).toHaveTextContent(
      '第二段内容',
    );
  });

  it('switches reader content when activeId prop changes', () => {
    const { rerender } = renderWithProviders(
      <MaterialPane materials={M} activeId="a" onActiveChange={vi.fn()} />,
    );
    expect(screen.getByTestId('shenlun-material-reader').getAttribute('data-material-id'))
      .toBe('a');
    rerender(
      <MaterialPane materials={M} activeId="c" onActiveChange={vi.fn()} />,
    );
    expect(screen.getByTestId('shenlun-material-reader').getAttribute('data-material-id'))
      .toBe('c');
  });

  it('throws when activeId is not present in materials (fail-fast)', () => {
    // React 18+ renders the error boundary path; suppress noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      renderWithProviders(
        <MaterialPane
          materials={M}
          activeId="missing"
          onActiveChange={vi.fn()}
        />,
      ),
    ).toThrow(/MaterialPane: activeId="missing"/);
    spy.mockRestore();
  });

  it('has correct aria-label on nav region', () => {
    renderWithProviders(
      <MaterialPane materials={M} activeId="a" onActiveChange={vi.fn()} />,
    );
    const nav = screen.getByTestId('shenlun-material-pane-nav');
    expect(nav.getAttribute('aria-label')).toBe('材料导航');
  });
});
