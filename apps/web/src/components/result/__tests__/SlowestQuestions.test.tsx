import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlowestQuestions } from '../SlowestQuestions';
import type { QuestionTiming } from '@sikao/shared-utils';

function t(qid: string, no: number, elapsedSec: number): QuestionTiming {
  return { questionId: qid, questionNo: no, elapsedSec, paused: false };
}

describe('SlowestQuestions', () => {
  it('returns null for empty slowest', () => {
    const { container } = render(<SlowestQuestions slowest={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per slowest entry', () => {
    render(<SlowestQuestions slowest={[t('1', 42, 252), t('2', 118, 238)]} />);
    expect(screen.getByTestId('slowest-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('slowest-row-2')).toBeInTheDocument();
  });

  it('shows question number with # prefix', () => {
    render(<SlowestQuestions slowest={[t('1', 42, 252)]} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('shows elapsed time formatted M:SS', () => {
    render(<SlowestQuestions slowest={[t('1', 42, 252)]} />);
    expect(screen.getByTestId('slowest-elapsed-1')).toHaveTextContent('4:12');
  });

  it('marks hot rows (>180s default) with text-err token', () => {
    render(<SlowestQuestions slowest={[t('h', 1, 200), t('c', 2, 100)]} />);
    expect(screen.getByTestId('slowest-elapsed-h').className).toContain('text-err');
    expect(screen.getByTestId('slowest-elapsed-c').className).not.toContain('text-err');
  });

  it('respects custom hotThresholdSec', () => {
    render(<SlowestQuestions slowest={[t('h', 1, 90), t('c', 2, 30)]} hotThresholdSec={60} />);
    expect(screen.getByTestId('slowest-elapsed-h').className).toContain('text-err');
    expect(screen.getByTestId('slowest-elapsed-c').className).not.toContain('text-err');
  });

  it('header title shows the actual number of items (TOP N is dynamic)', () => {
    render(<SlowestQuestions slowest={[t('1', 1, 100), t('2', 2, 50), t('3', 3, 30)]} />);
    expect(screen.getByText('用时最久 · TOP 3')).toBeInTheDocument();
  });

  it('chip shows the threshold in minutes', () => {
    render(<SlowestQuestions slowest={[t('1', 1, 100)]} hotThresholdSec={120} />);
    expect(screen.getByText('超 2 分钟标红')).toBeInTheDocument();
  });

  it('renders rows as <button> when onSelect is provided', () => {
    const onSelect = vi.fn();
    render(<SlowestQuestions slowest={[t('1', 1, 100)]} onSelect={onSelect} />);
    expect(screen.getByTestId('slowest-row-1').tagName).toBe('BUTTON');
  });

  it('renders rows as <div> when onSelect is omitted (no fake button)', () => {
    render(<SlowestQuestions slowest={[t('1', 1, 100)]} />);
    expect(screen.getByTestId('slowest-row-1').tagName).toBe('DIV');
  });

  it('clicking a row fires onSelect with questionId', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SlowestQuestions slowest={[t('q42', 42, 252)]} onSelect={onSelect} />);
    await user.click(screen.getByTestId('slowest-row-q42'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('q42');
  });
});
