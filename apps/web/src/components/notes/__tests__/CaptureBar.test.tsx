import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaptureBar } from '../CaptureBar';

describe('CaptureBar', () => {
  it('空输入 submit 按钮 disabled', () => {
    render(<CaptureBar onSubmit={() => {}} />);
    expect(screen.getByTestId('capture-bar-submit')).toBeDisabled();
  });

  it('输入 + 选 type / source → submit 返 payload', () => {
    const submit = vi.fn();
    render(<CaptureBar onSubmit={submit} />);
    fireEvent.change(screen.getByTestId('capture-bar-input'), {
      target: { value: '治理之细' },
    });
    fireEvent.click(screen.getByTestId('capture-bar-type-method'));
    fireEvent.change(screen.getByTestId('capture-bar-source-domain'), {
      target: { value: 'xingce' },
    });
    fireEvent.click(screen.getByTestId('capture-bar-submit'));
    expect(submit).toHaveBeenCalledWith({
      text: '治理之细',
      type: 'method',
      sourceDomain: 'xingce',
    });
  });

  it('Enter 触发 submit', () => {
    const submit = vi.fn();
    render(<CaptureBar onSubmit={submit} />);
    fireEvent.change(screen.getByTestId('capture-bar-input'), {
      target: { value: '快速' },
    });
    fireEvent.keyDown(screen.getByTestId('capture-bar-input'), {
      key: 'Enter',
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('Cmd+N: focus input', () => {
    render(<CaptureBar onSubmit={() => {}} />);
    const input = screen.getByTestId('capture-bar-input');
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: 'n', metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('isSubmitting: submit 按钮 disabled', () => {
    render(<CaptureBar onSubmit={() => {}} isSubmitting={true} />);
    fireEvent.change(screen.getByTestId('capture-bar-input'), {
      target: { value: 'x' },
    });
    expect(screen.getByTestId('capture-bar-submit')).toBeDisabled();
  });
});
