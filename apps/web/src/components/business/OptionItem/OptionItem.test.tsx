import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptionItem } from './OptionItem';
import type { OptionItemState } from './OptionItem';

const ALL_STATES: ReadonlyArray<OptionItemState> = [
  'rest',
  'selected',
  'correct',
  'wrong',
  'disabled',
  'reviewing',
];

describe('OptionItem', () => {
  it('renders all 6 states via data-state', () => {
    for (const state of ALL_STATES) {
      const { unmount, getByTestId } = render(
        <OptionItem label="A" text="北京" state={state} />,
      );
      expect(getByTestId('option-item').dataset.state).toBe(state);
      unmount();
    }
  });

  it('hides the letter chip when showLetter=false', () => {
    render(<OptionItem label="A" text="北京" state="rest" showLetter={false} />);
    expect(screen.queryByTestId('option-item-letter')).toBeNull();
  });

  it('shows letter chip by default', () => {
    render(<OptionItem label="B" text="上海" state="rest" />);
    expect(screen.getByTestId('option-item-letter').textContent).toBe('B');
  });

  it('reviewing state surfaces explanation by default', () => {
    render(
      <OptionItem
        label="C"
        text="广州"
        state="reviewing"
        explanation="正确答案是 A，本选项为常见误选。"
      />,
    );
    expect(screen.getByTestId('option-item-explanation').textContent).toContain(
      '正确答案',
    );
  });

  it('disabled state skips onClick and marks the button as disabled', () => {
    const onClick = vi.fn();
    render(<OptionItem label="D" text="深圳" state="disabled" onClick={onClick} />);
    const btn = screen.getByTestId('option-item');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
  });

  it('selected state exposes aria-pressed=true', () => {
    render(<OptionItem label="A" text="北京" state="selected" />);
    expect(
      screen.getByTestId('option-item').getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
