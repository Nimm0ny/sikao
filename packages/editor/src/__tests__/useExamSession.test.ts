import { beforeEach, describe, expect, it } from 'vitest';
import type { AnswerSession } from '@sikao/domain/shenlun/types';
import { mockPaper } from '@sikao/test-utils/essayExamMock';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';

describe('useExamSession', () => {
  beforeEach(() => {
    useExamSession.setState({
      paper: null,
      phase: 'prestart',
      currentQ: 0,
      textsByQ: [],
      elapsedByQ: [],
      warned5min: {},
      scratch: '',
      highlights: {},
      scratchClips: [],
      scratchNotes: [],
      citationsByQ: [],
      leftMode: 'normal',
      leftWidthPx: 320,
      matIdx: 0,
      drawerOpen: false,
      overview: false,
      marking: false,
      query: '',
      fontSize: 15,
      gridFontSize: 18,
      rightOpen: true,
      rightWidthPx: 260,
      celebrateQ: -1,
      warnToastQ: -1,
      searchFocusPulse: 0,
    });
  });

  it('hydrate initializes empty texts/elapsed for each question, focusing the first question', () => {
    useExamSession.getState().hydrate(mockPaper);
    const s = useExamSession.getState();
    expect(s.textsByQ).toHaveLength(mockPaper.questions.length);
    expect(s.textsByQ.every((t) => t === '')).toBe(true);
    expect(s.elapsedByQ).toHaveLength(mockPaper.questions.length);
    expect(s.currentQ).toBe(0);
    expect(s.phase).toBe('prestart');
  });

  it('phase transitions: prestart → running → paused → running → submitted', () => {
    useExamSession.getState().hydrate(mockPaper);
    const { start, togglePause, finish } = useExamSession.getState();
    start();
    expect(useExamSession.getState().phase).toBe('running');
    togglePause();
    expect(useExamSession.getState().phase).toBe('paused');
    togglePause();
    expect(useExamSession.getState().phase).toBe('running');
    finish();
    expect(useExamSession.getState().phase).toBe('submitted');
  });

  it('startSubmitting → phase=submitting (PR3)', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().start();
    useExamSession.getState().startSubmitting();
    expect(useExamSession.getState().phase).toBe('submitting');
  });

  it('togglePause is no-op in submitting and submitted phases (PR3 audit)', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().start();
    useExamSession.getState().startSubmitting();
    expect(useExamSession.getState().phase).toBe('submitting');
    useExamSession.getState().togglePause();
    expect(useExamSession.getState().phase).toBe('submitting'); // unchanged
    useExamSession.getState().finish();
    expect(useExamSession.getState().phase).toBe('submitted');
    useExamSession.getState().togglePause();
    expect(useExamSession.getState().phase).toBe('submitted'); // unchanged
  });

  it('tick is no-op in submitting/submitted phases (existing guard, audit)', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().setCurrentQ(0);
    useExamSession.getState().start();
    useExamSession.getState().tick();
    expect(useExamSession.getState().elapsedByQ[0]).toBe(1);
    useExamSession.getState().startSubmitting();
    useExamSession.getState().tick();
    expect(useExamSession.getState().elapsedByQ[0]).toBe(1); // unchanged
    useExamSession.getState().finish();
    useExamSession.getState().tick();
    expect(useExamSession.getState().elapsedByQ[0]).toBe(1); // still unchanged
  });

  // PR3 review P1 #6 — explicit state machine guards.
  it('startSubmitting from prestart is no-op (illegal transition)', () => {
    useExamSession.getState().hydrate(mockPaper);
    expect(useExamSession.getState().phase).toBe('prestart');
    useExamSession.getState().startSubmitting();
    expect(useExamSession.getState().phase).toBe('prestart'); // 拒绝非法迁移
  });

  it('finish from prestart is no-op (illegal transition)', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().finish();
    expect(useExamSession.getState().phase).toBe('prestart');
  });

  it('finish from submitted is idempotent no-op (already terminal)', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().start();
    useExamSession.getState().finish();
    expect(useExamSession.getState().phase).toBe('submitted');
    useExamSession.getState().finish();
    expect(useExamSession.getState().phase).toBe('submitted');
  });

  it('pause is no-op when not running (e.g. from paused / submitting)', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().start();
    useExamSession.getState().pause();
    expect(useExamSession.getState().phase).toBe('paused');
    useExamSession.getState().pause();
    expect(useExamSession.getState().phase).toBe('paused'); // unchanged
  });

  it('tick increments only the current question elapsed and only when running', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().setCurrentQ(2);
    useExamSession.getState().tick();
    expect(useExamSession.getState().elapsedByQ[2]).toBe(0); // not running yet

    useExamSession.getState().start();
    useExamSession.getState().tick();
    useExamSession.getState().tick();
    expect(useExamSession.getState().elapsedByQ[2]).toBe(2);
    expect(useExamSession.getState().elapsedByQ[0]).toBe(0);
  });

  it('tick clamps at duration', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().setCurrentQ(0);
    useExamSession.getState().start();
    const duration = mockPaper.questions[0].durationSec;
    useExamSession.setState({
      elapsedByQ: useExamSession.getState().elapsedByQ.map((_, i) => (i === 0 ? duration : 0)),
    });
    useExamSession.getState().tick();
    expect(useExamSession.getState().elapsedByQ[0]).toBe(duration);
  });

  it('setText updates only the targeted question', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().setText(0, '甲乙丙');
    useExamSession.getState().setText(2, (prev) => prev + 'X');
    expect(useExamSession.getState().textsByQ[0]).toBe('甲乙丙');
    expect(useExamSession.getState().textsByQ[2]).toBe('X');
    expect(useExamSession.getState().textsByQ[1]).toBe('');
  });

  it('jumpToMaterial expands a collapsed left panel', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().setLeftMode('collapsed');
    useExamSession.getState().jumpToMaterial('m3');
    const s = useExamSession.getState();
    expect(s.matIdx).toBe(2);
    expect(s.leftMode).toBe('normal');
  });

  it('jumpToMaterial keeps wide mode when already wide', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().setLeftMode('wide');
    useExamSession.getState().jumpToMaterial('m1');
    expect(useExamSession.getState().leftMode).toBe('wide');
  });

  it('setLeftWidthPx clamps to [240, 720]', () => {
    useExamSession.getState().setLeftWidthPx(100);
    expect(useExamSession.getState().leftWidthPx).toBe(240);
    useExamSession.getState().setLeftWidthPx(900);
    expect(useExamSession.getState().leftWidthPx).toBe(720);
    useExamSession.getState().setLeftWidthPx(420);
    expect(useExamSession.getState().leftWidthPx).toBe(420);
  });

  it('requestFocusSearch increments the pulse counter (counter, not toggle, so successive ⌘F never coalesce)', () => {
    expect(useExamSession.getState().searchFocusPulse).toBe(0);
    useExamSession.getState().requestFocusSearch();
    expect(useExamSession.getState().searchFocusPulse).toBe(1);
    useExamSession.getState().requestFocusSearch();
    expect(useExamSession.getState().searchFocusPulse).toBe(2);
  });

  it('toSnapshot serialises the persistable subset of state', () => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().setText(0, '甲');
    useExamSession.getState().setScratch('立意');
    const snap = useExamSession.getState().toSnapshot();
    expect(snap?.paperId).toBe(mockPaper.id);
    expect(snap?.textsByQ[0]).toBe('甲');
    expect(snap?.scratch).toBe('立意');
  });
  it('toSnapshot serialises SIKAO V3 scratch clips, notes, and citations', () => {
    useExamSession.getState().hydrate(mockPaper);
    const clip = {
      id: 'clip-1',
      matId: 'm1',
      start: 4,
      end: 12,
      text: 'governance quote',
      sourceLabel: 'M1-P1',
      position: 0,
      addedAt: 1710000000000,
    };
    const note = {
      id: 'note-1',
      body: 'Outline the countermeasure first.',
      position: 0,
      addedAt: 1710000001000,
    };
    const citation = {
      id: 'cite-1',
      clipId: 'clip-1',
      text: 'governance quote',
      sourceLabel: 'M1-P1',
      insertedAt: 1710000002000,
    };

    useExamSession.getState().addScratchClip(clip);
    useExamSession.getState().addScratchNote(note);
    useExamSession.getState().addCitation(1, citation);

    const snap = useExamSession.getState().toSnapshot();
    expect(snap?.scratchClips).toEqual([clip]);
    expect(snap?.scratchNotes).toEqual([note]);
    expect(snap?.citationsByQ).toHaveLength(mockPaper.questions.length);
    expect(snap?.citationsByQ?.[1]).toEqual([citation]);
  });

  it('hydrate restores SIKAO V3 snapshot fields and pads citations to paper question count', () => {
    const snapshot: AnswerSession = {
      paperId: mockPaper.id,
      startedAt: 1710000010000,
      phase: 'running',
      currentQ: 1,
      textsByQ: mockPaper.questions.map((_, index) => `answer-${index}`),
      elapsedByQ: mockPaper.questions.map((_, index) => index),
      highlights: {},
      scratch: 'legacy scratch text',
      savedAt: 1710000020000,
      scratchClips: [
        {
          id: 'clip-1',
          matId: 'm1',
          start: 4,
          end: 12,
          text: 'governance quote',
          sourceLabel: 'M1-P1',
          position: 0,
          addedAt: 1710000000000,
        },
      ],
      scratchNotes: [
        {
          id: 'note-1',
          body: 'Outline the countermeasure first.',
          position: 0,
          addedAt: 1710000001000,
        },
      ],
      citationsByQ: [
        [],
        [
          {
            id: 'cite-1',
            clipId: 'clip-1',
            text: 'governance quote',
            sourceLabel: 'M1-P1',
            insertedAt: 1710000002000,
          },
        ],
      ],
    };

    useExamSession.getState().hydrate(mockPaper, snapshot);

    const state = useExamSession.getState();
    expect(state.scratchClips).toEqual(snapshot.scratchClips);
    expect(state.scratchNotes).toEqual(snapshot.scratchNotes);
    expect(state.citationsByQ).toHaveLength(mockPaper.questions.length);
    expect(state.citationsByQ[1]).toEqual(snapshot.citationsByQ?.[1]);
    expect(state.citationsByQ.slice(2)).toEqual(
      mockPaper.questions.slice(2).map(() => []),
    );
  });

  it('hydrate migrates old local snapshots by initializing missing V3 fields empty', () => {
    const oldSnapshot: AnswerSession = {
      paperId: mockPaper.id,
      startedAt: 1710000030000,
      phase: 'paused',
      currentQ: 0,
      textsByQ: mockPaper.questions.map(() => ''),
      elapsedByQ: mockPaper.questions.map(() => 0),
      highlights: {},
      scratch: 'old snapshot',
      savedAt: 1710000040000,
    };

    useExamSession.getState().hydrate(mockPaper, oldSnapshot);

    const state = useExamSession.getState();
    expect(state.scratchClips).toEqual([]);
    expect(state.scratchNotes).toEqual([]);
    expect(state.citationsByQ).toEqual(mockPaper.questions.map(() => []));
  });
});
