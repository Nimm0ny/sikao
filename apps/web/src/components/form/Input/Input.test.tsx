import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('calls onChange with the new string value when user types', () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} aria-label="昵称" />);
    const input = screen.getByLabelText('昵称');
    fireEvent.change(input, { target: { value: 'lhr' } });
    expect(onChange).toHaveBeenCalledWith('lhr');
  });

  it('renders error visual + helper text when invalid + errorText are set', () => {
    render(
      <Input
        value="abc"
        onChange={() => {}}
        aria-label="邮箱"
        invalid
        errorText="格式不对"
      />,
    );
    const input = screen.getByLabelText('邮箱');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('格式不对')).toBeInTheDocument();
    // aria-describedby points to the helper span id
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).not.toBeNull();
  });

  it('renders successText when set and not invalid (success visual)', () => {
    render(<Input value="ok" onChange={() => {}} aria-label="昵称" successText="可用" />);
    expect(screen.getByText('可用')).toBeInTheDocument();
  });

  it('renders prefix and suffix slots without breaking input width', () => {
    render(
      <Input
        value=""
        onChange={() => {}}
        aria-label="搜索"
        prefix={<span>🔍</span>}
        suffix={<span>×</span>}
      />,
    );
    expect(screen.getByTestId('input-prefix')).toBeInTheDocument();
    expect(screen.getByTestId('input-suffix')).toBeInTheDocument();
  });

  it('respects disabled and readOnly flags', () => {
    const { rerender } = render(
      <Input value="x" onChange={() => {}} aria-label="x" disabled />,
    );
    expect(screen.getByLabelText('x')).toBeDisabled();
    rerender(<Input value="x" onChange={() => {}} aria-label="x" readOnly />);
    expect(screen.getByLabelText('x')).toHaveAttribute('readonly');
  });
});
