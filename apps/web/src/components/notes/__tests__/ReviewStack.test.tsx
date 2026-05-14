import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewStack } from '../ReviewStack';
import type { NoteOutV2 } from '@sikao/api-client/queries/notebookQueries';

function makeNote(id: number, type: NoteOutV2['type'] = 'reflect'): NoteOutV2 {
  return {
    id,
    type,
    body: { text: `note ${id}` },
    sourceKind: 'manual',
    sourceRef: 'src',
    sourceQuote: null,
    sourceDomain: 'essay',
    title: `note-${id}`,
    tags: [],
    attachedTo: null,
    visibility: 'self',
    ease: 2.5,
    reviewCount: 0,
    reviewedAt: null,
    nextReviewAt: null,
    isPublic: false,
    publicAt: null,
    displayAnonymous: true,
    likesCount: 0,
    commentsCount: 0,
    questionId: null,
    createdAt: '2026-05-12T00:00:00Z',
    updatedAt: '2026-05-12T00:00:00Z',
  };
}

describe('ReviewStack', () => {
  it('empty: notes=[] → 渲 empty container 不渲 buttons', () => {
    render(<ReviewStack notes={[]} onSubmitReview={() => {}} />);
    expect(screen.getByTestId('review-stack-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('review-remembered')).not.toBeInTheDocument();
  });

  it('1 note: 顶卡渲 + 评分按钮可点', () => {
    const submit = vi.fn();
    render(<ReviewStack notes={[makeNote(1)]} onSubmitReview={submit} />);
    expect(screen.getByTestId('review-stack-ts-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('review-remembered'));
    expect(submit).toHaveBeenCalledWith(1, 5);
  });

  it('多 note: 评分后切到下一张', () => {
    const submit = vi.fn();
    render(
      <ReviewStack
        notes={[makeNote(1), makeNote(2), makeNote(3)]}
        onSubmitReview={submit}
      />,
    );
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('review-forgot'));
    expect(submit).toHaveBeenCalledWith(1, 0);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('onSkip: 点击 review-skip', () => {
    const skip = vi.fn();
    render(
      <ReviewStack
        notes={[makeNote(1)]}
        onSubmitReview={() => {}}
        onSkip={skip}
      />,
    );
    fireEvent.click(screen.getByTestId('review-skip'));
    expect(skip).toHaveBeenCalled();
  });
});
