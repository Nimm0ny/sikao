import { describe, it, expect, beforeEach } from 'vitest';
import { usePracticeStore } from '../usePracticeStore';

// SIKAO Phase 2a (2026-05-09): scratch clip 跨题持久化模型 unit test.

describe('usePracticeStore — scratchClips', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      sessionData: null,
      answers: {},
      flaggedQuestions: new Set(),
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
});
