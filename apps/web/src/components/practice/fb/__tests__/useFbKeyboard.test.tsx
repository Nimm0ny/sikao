import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFbKeyboard, type UseFbKeyboardArgs } from '../useFbKeyboard';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// P6 (2026-05-11): fb 键盘 dispatcher 测试.
//
// jsdom KeyboardEvent: 我们手动构造 event 然后 dispatch 到 window.
// 双填 code (物理键位) + key (字符) 是因为 useFbKeyboard 走 code 优先,
// 但 fallback 读 key — 测试两条路径都覆盖.

interface DispatchOpts {
  code?: string;
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: EventTarget;
  preventDefault?: () => void;
}

function dispatchKeydown(opts: DispatchOpts): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code: opts.code,
    key: opts.key ?? '',
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  if (opts.target !== undefined) {
    Object.defineProperty(event, 'target', { value: opts.target, writable: false });
  }
  if (opts.preventDefault !== undefined) {
    Object.defineProperty(event, 'preventDefault', { value: opts.preventDefault });
  }
  window.dispatchEvent(event);
  return event;
}

function makeSingleChoice(qid: number): QuestionDetailV2 {
  return {
    questionId: qid,
    paperRevisionId: '1',
    sectionId: 'sec-1',
    blockId: `block-${qid}`,
    questionNo: 1,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: {
      stem: 'stub',
      options: [
        { key: 'A', text: 'opt A' },
        { key: 'B', text: 'opt B' },
        { key: 'C', text: 'opt C' },
        { key: 'D', text: 'opt D' },
      ],
    },
  };
}

function makeMultiChoice(qid: number): QuestionDetailV2 {
  return { ...makeSingleChoice(qid), questionKind: 'multiple_choice', rendererKey: 'multiple_choice' };
}

function makeTrueFalse(qid: number): QuestionDetailV2 {
  return { ...makeSingleChoice(qid), questionKind: 'true_false', rendererKey: 'true_false' };
}

function makeArgs(overrides: Partial<UseFbKeyboardArgs> = {}): UseFbKeyboardArgs {
  return {
    currentQuestion: null,
    answers: {},
    onAnswer: vi.fn(),
    togglePause: vi.fn(),
    openDock: vi.fn(),
    togglePassagesCollapsed: vi.fn(),
    undoHighlight: vi.fn(),
    ...overrides,
  };
}

describe('useFbKeyboard', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode !== null) container.parentNode.removeChild(container);
  });

  it('Digit1 on single_choice → onAnswer(qid, [A])', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeSingleChoice(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    dispatchKeydown({ code: 'Digit1', key: '1' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['A']);
  });

  it('Digit4 on single_choice → onAnswer(qid, [D])', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeSingleChoice(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    dispatchKeydown({ code: 'Digit4', key: '4' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['D']);
  });

  it('Digit2 on multiple_choice + empty → onAnswer(qid, [B]) (toggle add)', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeMultiChoice(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, answers: {}, onAnswer })));
    dispatchKeydown({ code: 'Digit2', key: '2' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['B']);
  });

  it('Digit2 on multiple_choice + already [A] → onAnswer(qid, [A,B]) (toggle add sorted)', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeMultiChoice(101);
    renderHook(() =>
      useFbKeyboard(makeArgs({ currentQuestion, answers: { '101': ['A'] }, onAnswer })),
    );
    dispatchKeydown({ code: 'Digit2', key: '2' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['A', 'B']);
  });

  it('Digit1 on multiple_choice + already [A,B] → onAnswer(qid, [B]) (toggle remove)', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeMultiChoice(101);
    renderHook(() =>
      useFbKeyboard(makeArgs({ currentQuestion, answers: { '101': ['A', 'B'] }, onAnswer })),
    );
    dispatchKeydown({ code: 'Digit1', key: '1' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['B']);
  });

  it('Digit1 on true_false → no-op (T/F 走 KeyT/KeyF)', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeTrueFalse(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    dispatchKeydown({ code: 'Digit1', key: '1' });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('KeyT on true_false → onAnswer(qid, [T])', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeTrueFalse(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    dispatchKeydown({ code: 'KeyT', key: 't' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['T']);
  });

  it('KeyF on true_false → onAnswer(qid, [F])', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeTrueFalse(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    dispatchKeydown({ code: 'KeyF', key: 'f' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['F']);
  });

  it('KeyT on single_choice → no-op (T/F 仅 TF 题)', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeSingleChoice(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    dispatchKeydown({ code: 'KeyT', key: 't' });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('Space → togglePause 调', () => {
    const togglePause = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ togglePause })));
    dispatchKeydown({ code: 'Space', key: ' ' });
    expect(togglePause).toHaveBeenCalledTimes(1);
  });

  it('KeyA → openDock 调', () => {
    const openDock = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ openDock })));
    dispatchKeydown({ code: 'KeyA', key: 'a' });
    expect(openDock).toHaveBeenCalledTimes(1);
  });

  it('KeyP → togglePassagesCollapsed 调', () => {
    const togglePassagesCollapsed = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ togglePassagesCollapsed })));
    dispatchKeydown({ code: 'KeyP', key: 'p' });
    expect(togglePassagesCollapsed).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Z (no shift) → undoHighlight 调 + preventDefault', () => {
    const undoHighlight = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ undoHighlight })));
    const pd = vi.fn();
    dispatchKeydown({ code: 'KeyZ', key: 'z', metaKey: true, preventDefault: pd });
    expect(undoHighlight).toHaveBeenCalledTimes(1);
    expect(pd).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Z (Win/Linux) → undoHighlight 调', () => {
    const undoHighlight = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ undoHighlight })));
    dispatchKeydown({ code: 'KeyZ', key: 'z', ctrlKey: true });
    expect(undoHighlight).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Shift+Z → undoHighlight 不调 (redo 不属于本 hook)', () => {
    const undoHighlight = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ undoHighlight })));
    dispatchKeydown({ code: 'KeyZ', key: 'z', metaKey: true, shiftKey: true });
    expect(undoHighlight).not.toHaveBeenCalled();
  });

  it('P 键 with Ctrl modifier → togglePassagesCollapsed 不调 (避免拦穿系统快捷)', () => {
    const togglePassagesCollapsed = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ togglePassagesCollapsed })));
    dispatchKeydown({ code: 'KeyP', key: 'p', ctrlKey: true });
    expect(togglePassagesCollapsed).not.toHaveBeenCalled();
  });

  it('target=<input> + Digit1 → onAnswer 不调 (输入态 guard)', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeSingleChoice(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    const input = document.createElement('input');
    container.appendChild(input);
    dispatchKeydown({ code: 'Digit1', key: '1', target: input });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('target=<textarea> + Space → togglePause 不调', () => {
    const togglePause = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ togglePause })));
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);
    dispatchKeydown({ code: 'Space', key: ' ', target: textarea });
    expect(togglePause).not.toHaveBeenCalled();
  });

  it('target 在 contenteditable=true 父级内 → KeyP 不调', () => {
    const togglePassagesCollapsed = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ togglePassagesCollapsed })));
    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'true');
    const child = document.createElement('span');
    ce.appendChild(child);
    container.appendChild(ce);
    dispatchKeydown({ code: 'KeyP', key: 'p', target: child });
    expect(togglePassagesCollapsed).not.toHaveBeenCalled();
  });

  it('target=<input> + Cmd+Z → undoHighlight 不调 (让浏览器原生 undo)', () => {
    const undoHighlight = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ undoHighlight })));
    const input = document.createElement('input');
    container.appendChild(input);
    dispatchKeydown({ code: 'KeyZ', key: 'z', metaKey: true, target: input });
    expect(undoHighlight).not.toHaveBeenCalled();
  });

  it('currentQuestion=null + Digit1 → onAnswer 不调 (无目标题)', () => {
    const onAnswer = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion: null, onAnswer })));
    dispatchKeydown({ code: 'Digit1', key: '1' });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('currentQuestion=null + KeyP → togglePassagesCollapsed 仍调 (P 跟 currentQ 无关)', () => {
    const togglePassagesCollapsed = vi.fn();
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion: null, togglePassagesCollapsed })));
    dispatchKeydown({ code: 'KeyP', key: 'p' });
    expect(togglePassagesCollapsed).toHaveBeenCalledTimes(1);
  });

  it('Digit1 via event.key fallback (无 code) → onAnswer 仍调', () => {
    const onAnswer = vi.fn();
    const currentQuestion = makeSingleChoice(101);
    renderHook(() => useFbKeyboard(makeArgs({ currentQuestion, onAnswer })));
    dispatchKeydown({ key: '1' });
    expect(onAnswer).toHaveBeenCalledWith('101', ['A']);
  });

  it('unmount → removeEventListener, 后续按键不触发', () => {
    const togglePause = vi.fn();
    const { unmount } = renderHook(() => useFbKeyboard(makeArgs({ togglePause })));
    unmount();
    dispatchKeydown({ code: 'Space', key: ' ' });
    expect(togglePause).not.toHaveBeenCalled();
  });

  it('latest args via ref: currentQuestion 更新后 Digit1 用新 qid', () => {
    const onAnswer = vi.fn();
    const { rerender } = renderHook(
      (args: UseFbKeyboardArgs) => useFbKeyboard(args),
      { initialProps: makeArgs({ currentQuestion: makeSingleChoice(101), onAnswer }) },
    );
    rerender(makeArgs({ currentQuestion: makeSingleChoice(202), onAnswer }));
    dispatchKeydown({ code: 'Digit1', key: '1' });
    expect(onAnswer).toHaveBeenCalledWith('202', ['A']);
  });
});
