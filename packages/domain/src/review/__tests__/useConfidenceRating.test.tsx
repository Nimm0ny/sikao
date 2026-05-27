import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useConfidenceRating } from '../useConfidenceRating';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useConfidenceRating', () => {
  it('starts empty by default', () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useConfidenceRating({ itemId: 101 }), {
      wrapper: createWrapper(client),
    });

    expect(result.current.confidence).toBeNull();
    expect(result.current.recallText).toBe('');
  });

  it('tracks local confidence and recall state', () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useConfidenceRating({ itemId: 101, forced: true }), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.setConfidence('certain');
      result.current.setRecallText('先回忆了公式');
    });

    expect(result.current.confidence).toBe('certain');
    expect(result.current.recallText).toBe('先回忆了公式');
    expect(result.current.forced).toBe(true);
  });

  it('resets local state', () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useConfidenceRating({ itemId: 101 }), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.setConfidence('likely');
      result.current.setRecallText('记得大意');
      result.current.reset();
    });

    expect(result.current.confidence).toBeNull();
    expect(result.current.recallText).toBe('');
  });

  it('submits confidence and recall through review attempt mutation', async () => {
    server.use(
      http.post('/api/v2/review/items/101/attempt', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          item: {
            id: 101,
            kind: 'wrong_answer',
            title: 'Review item',
            href: '/q/101',
            status: 'in_progress',
            questionId: 101,
            correctStreak: 1,
            hasCauseAnalysis: false,
            hasUserNotes: false,
            createdAt: '2026-05-20T00:00:00Z',
            updatedAt: '2026-05-20T00:00:00Z',
            nextReviewAt: '2026-05-28T00:00:00Z',
            submittedPayload: body,
          },
          history: [],
          actions: [],
          metadata: {},
        });
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useConfidenceRating({ itemId: 101 }), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.setConfidence('likely');
      result.current.setRecallText('记得大意');
    });
    await act(async () => {
      await result.current.submit({
        isCorrect: false,
        userAnswer: 'B',
      });
    });

    await waitFor(() => expect(result.current.submitAttemptMutation.isSuccess).toBe(true));
  });

  it('surfaces submit failures through the mutation state', async () => {
    server.use(
      http.post('/api/v2/review/items/101/attempt', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useConfidenceRating({ itemId: 101 }), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.submit({
          isCorrect: false,
          userAnswer: 'B',
        }),
      ).rejects.toBeTruthy();
    });

    await waitFor(() => expect(result.current.submitAttemptMutation.isError).toBe(true));
  });
});
