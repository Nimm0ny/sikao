import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders with fixed `rows` attribute when in rows mode', () => {
    render(<Textarea value="" onChange={() => {}} aria-label="备注" rows={4} />);
    const ta = screen.getByLabelText('备注') as HTMLTextAreaElement;
    expect(ta.rows).toBe(4);
  });

  it('throws when rows + autosize are passed together (fail-fast contract)', () => {
    // Suppress React render error spam on intentional throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Textarea
          value=""
          onChange={() => {}}
          aria-label="x"
          rows={4}
          autosize={{ min: 2, max: 8 }}
        />,
      ),
    ).toThrow(/mutually exclusive/);
    spy.mockRestore();
  });

  it('autosize applies an inline height clamped to min*line-height on mount', () => {
    // Force scrollHeight to 0 so the empty-mount clamp must lift the height
    // up to min * LINE_HEIGHT_PX[md] = 4 * 21 = 84px.
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return 0;
      },
    });
    render(
      <Textarea
        value=""
        onChange={() => {}}
        aria-label="申论"
        autosize={{ min: 4, max: 10 }}
      />,
    );
    const ta = screen.getByLabelText('申论') as HTMLTextAreaElement;
    expect(ta.style.height).toBe('84px');
  });

  it('showCount renders N/maxLength and turns warn at >=90% threshold', () => {
    const { rerender } = render(
      <Textarea
        value="abcd"
        onChange={() => {}}
        aria-label="x"
        maxLength={10}
        showCount
      />,
    );
    const counter = screen.getByTestId('textarea-count');
    expect(counter.textContent).toBe('4/10');
    expect(counter.dataset.warn).toBeUndefined();
    // 9/10 → 90% threshold (Math.floor(10 * 0.9) = 9) → warn on
    rerender(
      <Textarea
        value="abcdefghi"
        onChange={() => {}}
        aria-label="x"
        maxLength={10}
        showCount
      />,
    );
    expect(screen.getByTestId('textarea-count').dataset.warn).toBe('true');
  });

  it('forwards onChange with the new string value', () => {
    const onChange = vi.fn();
    render(<Textarea value="" onChange={onChange} aria-label="x" />);
    fireEvent.change(screen.getByLabelText('x'), { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalledWith('hi');
  });
});
