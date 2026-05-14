import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../Checkbox';

describe('Checkbox', () => {
  it('renders label + a11y-bound input', () => {
    render(<Checkbox id="c1" checked={false} onChange={() => {}} label="同意条款" />);
    expect(screen.getByText('同意条款')).toBeInTheDocument();
    const input = screen.getByRole('checkbox');
    expect(input).toBeInTheDocument();
  });

  it('checked prop reflects to input', () => {
    render(<Checkbox checked={true} onChange={() => {}} label="x" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('onChange called with new checked value when toggled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox checked={false} onChange={onChange} label="x" />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled blocks interaction', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox checked={false} onChange={onChange} label="x" disabled />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses accent-1 tint via accent-color (spec §5 .check-row)', () => {
    render(<Checkbox checked={false} onChange={() => {}} label="x" />);
    const input = screen.getByRole('checkbox');
    expect(input.className).toContain('accent-[var(--accent-1)]');
  });
});
