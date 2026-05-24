import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnswerSheet } from './AnswerSheet';
import type { AnswerSheetQuestion } from './AnswerSheet';

function makeQuestions(count: number): AnswerSheetQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    state: i === 0 ? 'current' : 'unanswered',
  }));
}

describe('AnswerSheet', () => {
  it('applies grid cols via data-cols (default 5)', () => {
    render(<AnswerSheet questions={makeQuestions(10)} onJump={() => {}} />);
    expect(screen.getByTestId('answer-sheet').dataset.cols).toBe('5');
  });

  it('honors custom cols=10 for dense layouts', () => {
    render(<AnswerSheet questions={makeQuestions(20)} cols={10} onJump={() => {}} />);
    expect(screen.getByTestId('answer-sheet').dataset.cols).toBe('10');
  });

  it('clicking a cell triggers onJump with the question number', () => {
    const onJump = vi.fn();
    render(<AnswerSheet questions={makeQuestions(10)} onJump={onJump} />);
    fireEvent.click(screen.getByTestId('answer-sheet-cell-3'));
    expect(onJump).toHaveBeenCalledWith(3);
  });

  it('renders 4 cell states via data-state', () => {
    render(
      <AnswerSheet
        questions={[
          { number: 1, state: 'unanswered' },
          { number: 2, state: 'answered' },
          { number: 3, state: 'marked' },
          { number: 4, state: 'current' },
        ]}
        onJump={() => {}}
      />,
    );
    expect(screen.getByTestId('answer-sheet-cell-1').dataset.state).toBe('unanswered');
    expect(screen.getByTestId('answer-sheet-cell-2').dataset.state).toBe('answered');
    expect(screen.getByTestId('answer-sheet-cell-3').dataset.state).toBe('marked');
    expect(screen.getByTestId('answer-sheet-cell-4').dataset.state).toBe('current');
  });

  it('arrow keys move focus across the grid', () => {
    render(<AnswerSheet questions={makeQuestions(10)} cols={5} onJump={() => {}} />);
    const cell1 = screen.getByTestId('answer-sheet-cell-1');
    cell1.focus();
    fireEvent.keyDown(cell1, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId('answer-sheet-cell-2'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId('answer-sheet-cell-7'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByTestId('answer-sheet-cell-6'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByTestId('answer-sheet-cell-1'));
  });
});
