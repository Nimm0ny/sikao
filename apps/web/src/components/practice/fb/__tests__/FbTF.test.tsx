import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbTF } from '../FbTF';

describe('FbTF (P3b 判断题 pill)', () => {
  it('renders 2 pills (正确 / 错误) as radiogroup', () => {
    render(<FbTF questionId="q1" selected={[]} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toBeInTheDocument();
    expect(group).toHaveAttribute('aria-label', '第 q1 题判断选项');
    expect(group).toHaveAttribute('data-testid', 'fb-tf-q1');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText('正确')).toBeInTheDocument();
    expect(screen.getByText('错误')).toBeInTheDocument();
  });

  it('clicking T pill fires onChange with ["T"]', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FbTF questionId="q1" selected={[]} onChange={onChange} />);
    await user.click(screen.getByTestId('fb-tf-opt-T'));
    expect(onChange).toHaveBeenCalledWith('q1', ['T']);
  });

  it('clicking F pill fires onChange with ["F"]', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FbTF questionId="q1" selected={[]} onChange={onChange} />);
    await user.click(screen.getByTestId('fb-tf-opt-F'));
    expect(onChange).toHaveBeenCalledWith('q1', ['F']);
  });

  it('selected=["T"] applies border-exam-accent + bg-exam-accent-50 className', () => {
    render(<FbTF questionId="q1" selected={['T']} onChange={vi.fn()} />);
    const optT = screen.getByTestId('fb-tf-opt-T');
    expect(optT).toHaveAttribute('aria-checked', 'true');
    expect(optT).toHaveAttribute('data-state', 'selected');
    expect(optT.className).toContain('border-exam-accent');
    expect(optT.className).toContain('bg-exam-accent-50');
    const optF = screen.getByTestId('fb-tf-opt-F');
    expect(optF).toHaveAttribute('aria-checked', 'false');
    expect(optF).toHaveAttribute('data-state', 'unanswered');
    expect(optF.className).not.toContain('border-exam-accent');
  });

  it('pressing T key on focused pill fires onChange with ["T"]', () => {
    const onChange = vi.fn();
    render(<FbTF questionId="q1" selected={[]} onChange={onChange} />);
    const optF = screen.getByTestId('fb-tf-opt-F');
    optF.focus();
    fireEvent.keyDown(optF, { key: 'T' });
    expect(onChange).toHaveBeenCalledWith('q1', ['T']);
  });

  it('pressing F key on focused pill fires onChange with ["F"]', () => {
    const onChange = vi.fn();
    render(<FbTF questionId="q1" selected={[]} onChange={onChange} />);
    const optT = screen.getByTestId('fb-tf-opt-T');
    optT.focus();
    fireEvent.keyDown(optT, { key: 'F' });
    expect(onChange).toHaveBeenCalledWith('q1', ['F']);
  });

  it('disabled blocks click + keydown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FbTF questionId="q1" selected={[]} onChange={onChange} disabled />);
    const optT = screen.getByTestId('fb-tf-opt-T');
    expect(optT).toBeDisabled();
    await user.click(optT);
    fireEvent.keyDown(optT, { key: 'T' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('aria-label includes 快捷键 hint per pill', () => {
    render(<FbTF questionId="q1" selected={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId('fb-tf-opt-T')).toHaveAttribute(
      'aria-label',
      '判断 正确 (快捷键 T)',
    );
    expect(screen.getByTestId('fb-tf-opt-F')).toHaveAttribute(
      'aria-label',
      '判断 错误 (快捷键 F)',
    );
  });
});
