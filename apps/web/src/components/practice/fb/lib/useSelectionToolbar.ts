import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@sikao/shared-utils';

// P5b/1 划线浮工具条 hook (SIKAO 答题系统行测).
//
// 数据流:
//   1. caller (FbActions 🖋 btn 点击) → arm(questionId)
//        → mode 'idle' → 'armed', armedQid 设
//   2. 用户在题干内拖选 → selectionchange (debounce 150ms)
//        → mode 'armed' → 'selecting', toolbarRect 计算
//   3. 收起选区 / Esc / close() / 切到别 qid
//        → mode → 'idle', armedQid clear, toolbarRect = null
//
// 位置计算:
//   - Range.getBoundingClientRect 取选区视口 rect
//   - 默认显示在选区上方 8px (toolbar 高 ~36px → top - 36 - 8)
//   - fallback: top - 44 < 56 (FbTopbar z-30 56px 高) → 下方 (rect.bottom + 8)
//
// Dumb by contract: hook 不读 store / 路由 / 后端. 仅 selection API + 位置算法.

export type SelectionToolbarMode = 'idle' | 'armed' | 'selecting';

export interface UseSelectionToolbarReturn {
  readonly mode: SelectionToolbarMode;
  readonly armedQid: string | null;
  readonly toolbarRect: DOMRect | null;
  /** caller 点 🖋 启动: 进入 armed 态, 等待用户拖选. */
  readonly arm: (questionId: string) => void;
  /** 收起工具条 (Esc / 外部点击 / 切题). */
  readonly close: () => void;
}

const SELECTION_DEBOUNCE_MS = 150;

/**
 * 当前 selection 是否在指定 questionId 的 fb-card 内部.
 * 用 data-question-id 锚定父级 (FbCard 已设).
 */
function selectionInsideQuestionCard(
  selection: Selection,
  questionId: string,
): { containerNode: Element; range: Range } | null {
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;
  const anchor =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  if (anchor === null) return null;
  const card = anchor.closest(`[data-question-id="${CSS.escape(questionId)}"]`);
  if (card === null) return null;
  if (!card.contains(range.endContainer)) return null;
  return { containerNode: card, range };
}

export function useSelectionToolbar(): UseSelectionToolbarReturn {
  const [mode, setMode] = useState<SelectionToolbarMode>('idle');
  const [armedQid, setArmedQid] = useState<string | null>(null);
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null);
  const armedQidRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    armedQidRef.current = armedQid;
  }, [armedQid]);

  const close = useCallback((): void => {
    setMode('idle');
    setArmedQid(null);
    setToolbarRect(null);
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const arm = useCallback((questionId: string): void => {
    logger.info('practice.fb.highlight.arm', { questionId });
    setArmedQid(questionId);
    setMode('armed');
    setToolbarRect(null);
  }, []);

  // selectionchange listener — armed 态下监测选区, 计算 toolbar rect.
  useEffect(() => {
    const onSelectionChange = (): void => {
      const qid = armedQidRef.current;
      if (qid === null) return;
      // debounce 150ms 防拖选过程频繁 setState.
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const selection = document.getSelection();
        if (selection === null) {
          setMode('armed');
          setToolbarRect(null);
          return;
        }
        const matched = selectionInsideQuestionCard(selection, qid);
        if (matched === null) {
          // 收起 / 跨题 / 折叠选区 → 维持 armed 但不显工具条
          setMode('armed');
          setToolbarRect(null);
          return;
        }
        const rect = matched.range.getBoundingClientRect();
        // 0×0 rect (空 range) 视为无效
        if (rect.width === 0 && rect.height === 0) {
          setMode('armed');
          setToolbarRect(null);
          return;
        }
        setMode('selecting');
        setToolbarRect(rect);
      }, SELECTION_DEBOUNCE_MS);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  return { mode, armedQid, toolbarRect, arm, close };
}
