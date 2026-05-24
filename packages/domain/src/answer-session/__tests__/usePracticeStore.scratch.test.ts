import { describe, it, expect, beforeEach } from 'vitest';
import { usePracticeStore } from '../usePracticeStore';
import type { PracticeSessionEnvelopeV2, TimingEventV2 } from '@sikao/api-client/types/practice';

// SIKAO Phase 2a (2026-05-09): scratch clip 跨题持久化模型 unit test.

describe('usePracticeStore — scratchClips', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      sessionData: null,
      sessionEnvelope: null,
      sessionLifecycle: null,
      mockExamCountdown: null,
      answers: {},
      flaggedQuestions: new Set(),
      favoritedQuestions: new Set(),
      persistentFlaggedQuestions: new Set(),
      viewedSolutionAnswerIds: new Set(),
      noteDrafts: {},
      pendingTimingEvents: [],
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
  });

  it('initially empty', () => {
    expect(usePracticeStore.getState().scratchClips).toEqual([]);
  });

  it('addScratchClip appends a clip with id + ts', () => {
    usePracticeStore.getState().addScratchClip({
      qid: '101',
      content: '差为等差',
      sourceLabel: 'Q16',
    });
    const clips = usePracticeStore.getState().scratchClips;
    expect(clips).toHaveLength(1);
    expect(clips[0].qid).toBe('101');
    expect(clips[0].content).toBe('差为等差');
    expect(clips[0].sourceLabel).toBe('Q16');
    expect(typeof clips[0].id).toBe('string');
    expect(typeof clips[0].createdAt).toBe('number');
  });

  it('addScratchClip is order-preserving', () => {
    usePracticeStore.getState().addScratchClip({ qid: '101', content: 'A' });
    usePracticeStore.getState().addScratchClip({ qid: '102', content: 'B' });
    usePracticeStore.getState().addScratchClip({ qid: '103', content: 'C' });
    const contents = usePracticeStore.getState().scratchClips.map((c) => c.content);
    expect(contents).toEqual(['A', 'B', 'C']);
  });

  it('removeScratchClip removes matching id', () => {
    usePracticeStore.getState().addScratchClip({ qid: '101', content: 'A' });
    const id = usePracticeStore.getState().scratchClips[0].id;
    usePracticeStore.getState().removeScratchClip(id);
    expect(usePracticeStore.getState().scratchClips).toEqual([]);
  });

  it('removeScratchClip ignores unknown id', () => {
    usePracticeStore.getState().addScratchClip({ qid: '101', content: 'A' });
    usePracticeStore.getState().removeScratchClip('nope');
    expect(usePracticeStore.getState().scratchClips).toHaveLength(1);
  });

  it('clearSession resets scratchClips + currentVisibleQuestionId', () => {
    usePracticeStore.getState().addScratchClip({ qid: '101', content: 'A' });
    usePracticeStore.getState().setCurrentVisibleQuestionId('101');
    usePracticeStore.getState().clearSession();
    expect(usePracticeStore.getState().scratchClips).toEqual([]);
    expect(usePracticeStore.getState().currentVisibleQuestionId).toBeNull();
  });

  it('setCurrentVisibleQuestionId updates field', () => {
    usePracticeStore.getState().setCurrentVisibleQuestionId('q42');
    expect(usePracticeStore.getState().currentVisibleQuestionId).toBe('q42');
    usePracticeStore.getState().setCurrentVisibleQuestionId(null);
    expect(usePracticeStore.getState().currentVisibleQuestionId).toBeNull();
  });

  it('bootstrapSessionEnvelope mirrors favorite / persistent flag / viewed solution state', () => {
    usePracticeStore.getState().addScratchClip({ qid: '999', content: 'stale' });
    usePracticeStore.getState().setNoteDraft('999', 'old draft');
    usePracticeStore.getState().enqueueTimingEvents([
      { answerId: 9, ts: '2026-05-24T00:00:00Z', type: 'answer_change' },
    ]);
    usePracticeStore.getState().setCurrentVisibleQuestionId('999');

    const envelope: PracticeSessionEnvelopeV2 = {
      actions: [],
      entryKind: 'paper',
      examMode: false,
      forceSubmitted: false,
      id: 11,
      items: [
        {
          answerChangeCount: 0,
          answerText: null,
          answerKind: 'single_choice',
          flagged: true,
          hasPersistentFlag: false,
          hasUserNotes: false,
          id: '1',
          isFavorited: true,
          isOvertime: false,
          prompt: 'Q1',
          questionKey: '101',
          selectedAnswerKeys: ['A'],
          status: 'answered',
          timeSpentMs: 0,
          viewedSolution: false,
          visitCount: 1,
        },
        {
          answerChangeCount: 0,
          answerText: null,
          answerKind: 'single_choice',
          flagged: false,
          hasPersistentFlag: true,
          hasUserNotes: false,
          id: '2',
          isFavorited: false,
          isOvertime: false,
          prompt: 'Q2',
          questionKey: '102',
          selectedAnswerKeys: ['B'],
          status: 'answered',
          timeSpentMs: 0,
          viewedSolution: true,
          visitCount: 1,
        },
      ],
      pausedCount: 0,
      pausedTotalSeconds: 0,
      practiceMode: 'full_set',
      sourceMode: 'paper',
      startedAt: '2026-05-24T00:00:00Z',
      status: 'in_progress',
      totalActiveSeconds: 0,
      track: 'xingce',
    };

    usePracticeStore.getState().bootstrapSessionEnvelope(envelope);

    expect(usePracticeStore.getState().flaggedQuestions.has(101)).toBe(true);
    expect(usePracticeStore.getState().favoritedQuestions.has(101)).toBe(true);
    expect(usePracticeStore.getState().persistentFlaggedQuestions.has(102)).toBe(true);
    expect(usePracticeStore.getState().viewedSolutionAnswerIds.has(2)).toBe(true);
    expect(usePracticeStore.getState().scratchClips).toEqual([]);
    expect(usePracticeStore.getState().noteDrafts).toEqual({});
    expect(usePracticeStore.getState().pendingTimingEvents).toEqual([]);
    expect(usePracticeStore.getState().currentVisibleQuestionId).toBeNull();
  });

  it('queues timing events and drains them atomically', () => {
    const events: TimingEventV2[] = [
      {
        answerId: 1,
        ts: '2026-05-24T00:00:00Z',
        type: 'question_enter',
      },
      {
        answerId: 1,
        ts: '2026-05-24T00:00:05Z',
        type: 'question_leave',
      },
    ];

    usePracticeStore.getState().enqueueTimingEvents(events);
    expect(usePracticeStore.getState().pendingTimingEvents).toHaveLength(2);

    const drained = usePracticeStore.getState().drainTimingEvents();
    expect(drained).toEqual(events);
    expect(usePracticeStore.getState().pendingTimingEvents).toEqual([]);
  });
});
