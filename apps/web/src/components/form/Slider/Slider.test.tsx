import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';

describe('Slider', () => {
  it('binds value to native <input type="range">', () => {
    render(
      <Slider
        value={15}
        onChange={() => {}}
        min={14}
        max={19}
        aria-label="字号"
      />,
    );
    const range = screen.getByLabelText('字号') as HTMLInputElement;
    expect(range.type).toBe('range');
    expect(range.value).toBe('15');
    expect(range.min).toBe('14');
    expect(range.max).toBe('19');
  });

  it('forwards onChange with numeric value when user drags / arrow-keys', () => {
    const onChange = vi.fn();
    render(
      <Slider
        value={15}
        onChange={onChange}
        min={14}
        max={19}
        aria-label="字号"
      />,
    );
    const range = screen.getByLabelText('字号');
    fireEvent.change(range, { target: { value: '17' } });
    expect(onChange).toHaveBeenCalledWith(17);
  });

  it('renders mark labels (e.g. font-size dial 紧凑/标准/大字/特大)', () => {
    render(
      <Slider
        value={15}
        onChange={() => {}}
        min={14}
        max={19}
        aria-label="字号"
        marks={[
          { value: 14, label: '紧凑' },
          { value: 15, label: '标准' },
          { value: 17, label: '大字' },
          { value: 19, label: '特大' },
        ]}
      />,
    );
    expect(screen.getByText('紧凑')).toBeInTheDocument();
    expect(screen.getByText('标准')).toBeInTheDocument();
    expect(screen.getByText('大字')).toBeInTheDocument();
    expect(screen.getByText('特大')).toBeInTheDocument();
  });

  it('disables native input + applies disabled visual state', () => {
    render(
      <Slider
        value={15}
        onChange={() => {}}
        min={14}
        max={19}
        aria-label="x"
        disabled
      />,
    );
    expect(screen.getByLabelText('x')).toBeDisabled();
  });

  it('throws fail-fast when value falls outside [min, max]', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Slider value={20} onChange={() => {}} min={14} max={19} aria-label="x" />,
      ),
    ).toThrow(/outside/);
    spy.mockRestore();
  });

  it('shows formatted value when showValue is true', () => {
    render(
      <Slider
        value={17}
        onChange={() => {}}
        min={14}
        max={19}
        aria-label="x"
        showValue
      />,
    );
    expect(screen.getByTestId('slider-value').textContent).toBe('17');
  });
});
