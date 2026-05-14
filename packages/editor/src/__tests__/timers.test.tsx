import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { ExamShell } from '../ExamShell';
import { PrestartModal } from '../modals/PrestartModal';
import { useExamSession } from '../hooks/useExamSession';
import { mockPaper } from '../data/essayExamMock';

// Time-driven behaviour that the rest of the suite couldn't cover with
// real timers — the autosave 1.5s debounce, the 5min warn-once gate, and
// the prestart 3s read countdown. Each spec uses vi.useFakeTimers() so
// the assertions are deterministic, then restores at teardown.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  useExamSession.setState({
    paper: null,
    phase: 'prestart',
    currentQ: 0,
    textsByQ: [],
    elapsedByQ: [],
    warned5min: {},
    scratch: '',
    highlights: {},
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
    celebrateQ: -1,
    warnToastQ: -1,
    searchFocusPulse: 0,
  });
});

function setupRunning() {
  useExamSession.getState().hydrate(mockPaper);
  useExamSession.setState({ phase: 'running' });
}

describe('autosave 1.5s debounce', () => {
  it('does NOT fire onAutosave before 1.5s elapsed', () => {
    setupRunning();
    let saveCount = 0;
    renderWithProviders(
      <ExamShell onAutosave={() => { saveCount += 1; }} onSubmit={() => {}} />,
    );
    act(() => {
      useExamSession.getState().setText(0, '一些字');
    });
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(saveCount).toBe(0);
  });

  it('fires onAutosave after 1.5s of quiet', () => {
    setupRunning();
    let saveCount = 0;
    renderWithProviders(
      <ExamShell onAutosave={() => { saveCount += 1; }} onSubmit={() => {}} />,
    );
    act(() => {
      useExamSession.getState().setText(0, '一些字');
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(saveCount).toBeGreaterThanOrEqual(1);
  });

  it('resets the debounce when text changes again before 1.5s', () => {
    setupRunning();
    let saveCount = 0;
    renderWithProviders(
      <ExamShell onAutosave={() => { saveCount += 1; }} onSubmit={() => {}} />,
    );
    act(() => {
      useExamSession.getState().setText(0, '一');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      useExamSession.getState().setText(0, '一二');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 1s + 1s = 2s wall clock, but each setText reset the timer; latest
    // change was 1s ago, debounce hasn't fired yet.
    expect(saveCount).toBe(0);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(saveCount).toBeGreaterThanOrEqual(1);
  });

  it('does NOT fire onAutosave when phase is submitted (terminal state)', () => {
    setupRunning();
    let saveCount = 0;
    renderWithProviders(
      <ExamShell onAutosave={() => { saveCount += 1; }} onSubmit={() => {}} />,
    );
    act(() => {
      useExamSession.setState({ phase: 'submitted' });
      useExamSession.getState().setText(0, 'after-submit edit');
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(saveCount).toBe(0);
  });

  it('does NOT fire onAutosave during prestart (nothing to save yet)', () => {
    useExamSession.getState().hydrate(mockPaper);
    // phase stays at prestart per hydrate default
    let saveCount = 0;
    renderWithProviders(
      <ExamShell onAutosave={() => { saveCount += 1; }} onSubmit={() => {}} />,
    );
    act(() => {
      useExamSession.getState().setText(0, 'cant-save-yet');
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(saveCount).toBe(0);
  });
});

describe('5min warn-once', () => {
  it('triggers warn5min(q) + warnToast exactly once when remaining drops into the threshold', () => {
    setupRunning();
    useExamSession.getState().setCurrentQ(0);
    // Q0 duration is 600s (10min). The threshold is min(300, round(600 * 0.25)) = 150s.
    // Set elapsed to one tick before crossing.
    const duration = mockPaper.questions[0].durationSec;
    const threshold = Math.min(5 * 60, Math.round(duration * 0.25));
    useExamSession.setState({
      elapsedByQ: mockPaper.questions.map((_, i) => (i === 0 ? duration - threshold - 1 : 0)),
    });
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(useExamSession.getState().warned5min[0]).toBeUndefined();
    // One 1Hz tick — elapsed crosses (duration - threshold), remaining hits the gate.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(useExamSession.getState().warned5min[0]).toBe(true);
    expect(useExamSession.getState().warnToastQ).toBe(0);
    // Toast hides after 4s
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(useExamSession.getState().warnToastQ).toBe(-1);
    // Subsequent ticks must not re-trigger warn5min for the same question.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useExamSession.getState().warnToastQ).toBe(-1);
  });
});

describe('PrestartModal 3s read countdown', () => {
  it('flips the start button from disabled to enabled after 3 seconds', () => {
    let started = 0;
    render(
      <PrestartModal
        question={mockPaper.questions[0]}
        onStart={() => { started += 1; }}
        onPreview={() => {}}
      />,
    );
    const btn = () => screen.getByTestId('exam-prestart-start-btn');
    expect(btn()).toBeDisabled();
    expect(btn()).toHaveTextContent(/请阅读… 3s/);
    // Advance one tick at a time so React commits each setCount before the
    // next setTimeout registers — vi.advanceTimersByTime(3000) in one shot
    // doesn't interleave React renders between each chained setTimeout.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(btn()).toHaveTextContent(/请阅读… 2s/);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(btn()).toHaveTextContent(/请阅读… 1s/);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(btn()).not.toBeDisabled();
    expect(btn()).toHaveTextContent('我已阅读 · 开始作答');
    btn().click();
    expect(started).toBe(1);
  });
});
