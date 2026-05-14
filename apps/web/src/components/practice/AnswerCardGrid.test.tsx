import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerCardGrid, type AnswerCardSection } from './AnswerCardGrid';

// cellStatus priority is current → done → pending (visual state).
// `marked` is an orthogonal flag overlay (orange triangle), not a status —
// otherwise marking the current question hides the current ring, and marking
// an answered question makes the cell look unanswered (P0-2).

function makeSection(): AnswerCardSection {
  return {
    sectionId: 'sec-1',
    title: '常识判断',
    questions: [
      { questionId: '1', questionNo: 1 },
      { questionId: '2', questionNo: 2 },
      { questionId: '3', questionNo: 3 },
      { questionId: '4', questionNo: 4 },
    ],
  };
}

function statusOf(qid: string): string | null {
  return screen.getByTestId(`answer-cell-${qid}`).getAttribute('data-state');
}

function flaggedOf(qid: string): string | null {
  return screen.getByTestId(`answer-cell-${qid}`).getAttribute('data-flagged');
}

describe('AnswerCardGrid cellStatus priority', () => {
  it('current question that is also marked: status=current + flagged=true', () => {
    render(
      <AnswerCardGrid
        sections={[makeSection()]}
        answeredQuestionIds={new Set()}
        flaggedQuestionIds={new Set(['1'])}
        activeQuestionIds={new Set(['1'])}
        activeSectionId="sec-1"
        onSelectQuestion={vi.fn()}
      />,
    );
    expect(statusOf('1')).toBe('current');
    expect(flaggedOf('1')).toBe('true');
  });

  it('answered question that is also marked: status=done + flagged=true', () => {
    render(
      <AnswerCardGrid
        sections={[makeSection()]}
        answeredQuestionIds={new Set(['2'])}
        flaggedQuestionIds={new Set(['2'])}
        activeQuestionIds={new Set(['1'])}
        activeSectionId="sec-1"
        onSelectQuestion={vi.fn()}
      />,
    );
    expect(statusOf('2')).toBe('done');
    expect(flaggedOf('2')).toBe('true');
  });

  it('marked-only question (no answer, not active): status=pending + flagged=true', () => {
    render(
      <AnswerCardGrid
        sections={[makeSection()]}
        answeredQuestionIds={new Set()}
        flaggedQuestionIds={new Set(['3'])}
        activeQuestionIds={new Set(['1'])}
        activeSectionId="sec-1"
        onSelectQuestion={vi.fn()}
      />,
    );
    expect(statusOf('3')).toBe('pending');
    expect(flaggedOf('3')).toBe('true');
  });

  it('plain pending question: status=pending + no flagged', () => {
    render(
      <AnswerCardGrid
        sections={[makeSection()]}
        answeredQuestionIds={new Set()}
        flaggedQuestionIds={new Set()}
        activeQuestionIds={new Set(['1'])}
        activeSectionId="sec-1"
        onSelectQuestion={vi.fn()}
      />,
    );
    expect(statusOf('4')).toBe('pending');
    expect(flaggedOf('4')).toBeNull();
  });

  it('answered without flag/active: status=done', () => {
    render(
      <AnswerCardGrid
        sections={[makeSection()]}
        answeredQuestionIds={new Set(['2'])}
        flaggedQuestionIds={new Set()}
        activeQuestionIds={new Set(['1'])}
        activeSectionId="sec-1"
        onSelectQuestion={vi.fn()}
      />,
    );
    expect(statusOf('2')).toBe('done');
    expect(flaggedOf('2')).toBeNull();
  });
});
