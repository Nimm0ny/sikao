import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Radio } from '../Radio';

describe('Radio', () => {
  it('renders label + radio input with name + value', () => {
    render(
      <Radio
        name="grp"
        value="a"
        checked={false}
        onChange={() => {}}
        label="选项 A"
      />,
    );
    expect(screen.getByText('选项 A')).toBeInTheDocument();
    const input = screen.getByRole('radio');
    expect(input).toHaveAttribute('name', 'grp');
    expect(input).toHaveAttribute('value', 'a');
  });

  it('checked prop reflects to input', () => {
    render(
      <Radio name="g" value="a" checked={true} onChange={() => {}} label="x" />,
    );
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('onChange called (no arg) when clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Radio name="g" value="a" checked={false} onChange={onChange} label="x" />,
    );
    await user.click(screen.getByRole('radio'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled blocks interaction', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Radio
        name="g"
        value="a"
        checked={false}
        onChange={onChange}
        label="x"
        disabled
      />,
    );
    await user.click(screen.getByRole('radio'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses accent-1 tint via accent-color (spec §5 .check-row)', () => {
    render(
      <Radio name="g" value="a" checked={false} onChange={() => {}} label="x" />,
    );
    expect(screen.getByRole('radio').className).toContain(
      'accent-[var(--accent-1)]',
    );
  });
});
