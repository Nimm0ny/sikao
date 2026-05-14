import { useEffect, useRef } from 'react';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// P6 (2026-05-11): fb 答题键盘 dispatcher (CLAUDE.md SPEC §10).
//
// 统一所有 fb 键盘快捷键, 避免分散 window listener:
//   - 1 / 2 / 3 / 4: 选当前题 A-D (questionKind 守卫)
//   - T / F: 选判断题 (currentVisible 是 TF 题时)
//   - Space: 暂停 / 继续
//   - A: 打开答题卡 dock
//   - P: 折叠 / 展开资料分析材料 (单 state passagesCollapsed, 全部 toggle)
//   - Cmd+Z / Ctrl+Z (不 Shift): 撤销划线 (接管 P5a useHighlightUndoKeyboard)
//
// 关键设计:
//   - event.code 物理键位 (不受输入法 / Shift 影响; 中文输入下 1-4 仍 work).
//   - input / textarea / contenteditable guard 统一; Esc 例外 (但 P6 不接 Esc).
//   - questionKind 守卫: 1-4 只 fire on single/multiple_choice; T/F 只 fire on true_false.
//   - currentQuestion null → 1-4 / T / F no-op (无目标题).
//   - 在 PracticeSession route 内 mount, 不全局 (App.tsx 不 wire).
//
// 不接 Esc 降级: FbDock / FbSettingsPopover / ExitConfirmModal 各自监听 Esc;
// P6 dispatch table 不含 Esc (master 决策, 见 task prompt G).
//
// Dumb by contract: hook 不读 store / 路由 / 后端. actions / state 全 caller 注入.

export interface UseFbKeyboardArgs {
  /**
   * 当前可视题 (PracticeSession 顶层 currentVisible). null → 1-4 / T / F no-op.
   * questionKind 决定 1-4 vs T/F 守卫.
   */
  readonly currentQuestion: QuestionDetailV2 | null;
  /** 当前已选 (P6 multi 题 toggle 用). qid → optionKeys[]. */
  readonly answers: Record<string, readonly string[]>;
  /** 选项 onAnswer(qid, optionKeys). */
  readonly onAnswer: (questionId: string, optionKeys: string[]) => void;
  /** Space 切暂停 / 继续. */
  readonly togglePause: () => void;
  /** A 打开答题卡 dock. */
  readonly openDock: () => void;
  /** P 折叠 / 展开 passage. 单 state, 不 per-mg. */
  readonly togglePassagesCollapsed: () => void;
  /** Cmd+Z / Ctrl+Z 撤销划线 (接 useHighlightStore.undo). */
  readonly undoHighlight: () => void;
}

/**
 * 当前 event.target 是否在文本输入区 (input / textarea / contenteditable).
 * 命中 → 跳过 dispatcher, 让浏览器原生处理 (i.e. 笔记区 P 字符不触发折叠).
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.matches('input, textarea, [contenteditable="true"], [contenteditable=""]')) {
    return true;
  }
  // 子节点在 contenteditable 父级内 (e.g. <p> in <div contenteditable>).
  if (target.closest('[contenteditable="true"], [contenteditable=""]') !== null) {
    return true;
  }
  return false;
}

/**
 * single_choice + 1-4 → 替换为该 option key (单选 idempotent).
 * multiple_choice + 1-4 → toggle option key 在 array 里 (sorted by SPEC order).
 */
function handleNumberKey(
  optionKey: 'A' | 'B' | 'C' | 'D',
  questionKind: string,
  qid: string,
  answers: Record<string, readonly string[]>,
  onAnswer: (questionId: string, optionKeys: string[]) => void,
): void {
  if (questionKind === 'single_choice') {
    onAnswer(qid, [optionKey]);
    return;
  }
  if (questionKind === 'multiple_choice') {
    const current = answers[qid] ?? [];
    const next = current.includes(optionKey)
      ? current.filter((k) => k !== optionKey)
      : [...current, optionKey].sort();
    onAnswer(qid, next);
    return;
  }
  // true_false / 其它 → 1-4 no-op.
}

/**
 * true_false + T/F → 替换为 ['T'] / ['F'] (idempotent 已选不取消).
 * single/multiple + T/F → no-op (留给 1-4).
 */
function handleTFKey(
  optionKey: 'T' | 'F',
  questionKind: string,
  qid: string,
  onAnswer: (questionId: string, optionKeys: string[]) => void,
): void {
  if (questionKind !== 'true_false') return;
  onAnswer(qid, [optionKey]);
}

export function useFbKeyboard({
  currentQuestion,
  answers,
  onAnswer,
  togglePause,
  openDock,
  togglePassagesCollapsed,
  undoHighlight,
}: UseFbKeyboardArgs): void {
  // 把 args 装 ref, 避免 listener 在每次 currentQuestion / answers 变时 re-attach.
  // 单 listener 生命周期 = 组件 mount → unmount, 内部读 latest ref.
  const argsRef = useRef({
    currentQuestion,
    answers,
    onAnswer,
    togglePause,
    openDock,
    togglePassagesCollapsed,
    undoHighlight,
  });
  useEffect(() => {
    argsRef.current = {
      currentQuestion,
      answers,
      onAnswer,
      togglePause,
      openDock,
      togglePassagesCollapsed,
      undoHighlight,
    };
  }, [
    currentQuestion,
    answers,
    onAnswer,
    togglePause,
    openDock,
    togglePassagesCollapsed,
    undoHighlight,
  ]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      // 输入态 guard (Esc 例外 — P6 不接 Esc 所以不区分).
      if (isTypingTarget(event.target)) return;

      const args = argsRef.current;

      // Cmd+Z / Ctrl+Z (no shift) → undo. 走最前因为 Z 是修饰组合 +
      // 1-4 / T / F / P 不允许 modifier.
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
        if (event.code === 'KeyZ' || event.key.toLowerCase() === 'z') {
          event.preventDefault();
          args.undoHighlight();
          return;
        }
        // 其它 modifier 组合 (Cmd+S 保存 / Cmd+R 刷新 / Cmd+F 搜索) 不拦.
        return;
      }

      // 之后所有快捷键禁修饰键 (防 alt-1 系统快捷 / shift+space 滚屏 拦穿).
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

      const current = args.currentQuestion;
      const qid = current !== null ? String(current.questionId) : null;
      const questionKind = current !== null ? current.questionKind : null;

      // P → toggle passage 折叠 (currentQuestion 无关, 单 state 全部 toggle).
      if (event.code === 'KeyP' || event.key.toLowerCase() === 'p') {
        event.preventDefault();
        args.togglePassagesCollapsed();
        return;
      }

      // A → 打开 dock.
      if (event.code === 'KeyA' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        args.openDock();
        return;
      }

      // Space → 切暂停. event.code === 'Space' 物理键; event.key === ' '.
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        args.togglePause();
        return;
      }

      // 1 / 2 / 3 / 4 → 选项 (currentQuestion + questionKind 守卫).
      if (qid !== null && questionKind !== null) {
        const digitMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
          Digit1: 'A',
          Digit2: 'B',
          Digit3: 'C',
          Digit4: 'D',
        };
        const fromCode = digitMap[event.code];
        if (fromCode !== undefined) {
          event.preventDefault();
          handleNumberKey(fromCode, questionKind, qid, args.answers, args.onAnswer);
          return;
        }
        // event.key 兜底 (虚拟键盘 / 输入法 fallback).
        const keyDigitMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
          '1': 'A',
          '2': 'B',
          '3': 'C',
          '4': 'D',
        };
        const fromKey = keyDigitMap[event.key];
        if (fromKey !== undefined) {
          event.preventDefault();
          handleNumberKey(fromKey, questionKind, qid, args.answers, args.onAnswer);
          return;
        }

        // T / F → 判断题选项.
        if (event.code === 'KeyT' || event.key.toLowerCase() === 't') {
          event.preventDefault();
          handleTFKey('T', questionKind, qid, args.onAnswer);
          return;
        }
        if (event.code === 'KeyF' || event.key.toLowerCase() === 'f') {
          event.preventDefault();
          handleTFKey('F', questionKind, qid, args.onAnswer);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // 单次 attach; 所有 args 走 ref.
  }, []);
}
