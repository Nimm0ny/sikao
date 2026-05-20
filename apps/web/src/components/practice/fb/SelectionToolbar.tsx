import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@sikao/shared-utils';
import { ActionUndoIcon, TrashIcon } from '@sikao/ui/icons';
import { useHighlightStore, type HighlightColorKey, type Mark } from '@sikao/domain/xingce/useHighlightStore';
import { serializeSelection } from './lib/highlightRange';
import './fb-highlight.css';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// P5b/1 划线浮工具条 (SIKAO 答题系统行测).
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md + SPEC.md §5
// + design/SIKAO/xingce-redesign/option-B-paper-quiet.html.
//
// 行为:
//   - createPortal(<div role="toolbar">, document.body) (避免父级 sticky / overflow 裁切)
//   - position fixed (rect 已是视口坐标) z-40 (高 FbTopbar z-30 + FbPassage z-20)
//   - 4 swatch button (L1/L2/L3/L4 ordinal) — 点击 → addMark + close
//   - 1 clear button — 点击调 useHighlightStore.removeMarks 删选区内 fb-hl
//   - 1 undo button — disabled when undoStack empty (subscribe 取)
//   - a11y: role=toolbar + aria-label=划线工具条 + 键盘 Left/Right 切 button + Esc 关
//
// Dumb by contract: 副作用全 prop 注入 (onColor / onClear / onUndo + close).

export interface SelectionToolbarProps {
  /** 当前 armed question id. close 时由 caller 清. */
  readonly questionId: string;
  /** Range 视口 rect (useSelectionToolbar 计算). */
  readonly rect: DOMRect;
  /** caller 通知关闭 (Esc / 选完 / 外部点击). */
  readonly onClose: () => void;
}

const SWATCH_ORDER: ReadonlyArray<{
  key: HighlightColorKey;
  label: string;
  level: 1 | 2 | 3 | 4;
}> = [
  { key: 'y', label: '重点', level: 1 },
  { key: 'g', label: '关注', level: 2 },
  { key: 'b', label: '重要', level: 3 },
  { key: 'p', label: '危险', level: 4 },
];

const TOOLBAR_HEIGHT = 40;
const TOPBAR_BUFFER = 56; // FbTopbar z-30 高 56px (Tailwind top-14)
const VIEWPORT_PADDING = 8;

interface ComputedPosition {
  readonly top: number;
  readonly left: number;
  readonly placement: 'above' | 'below';
}

/**
 * 位置算法:
 * 1. 默认上方 8px (rect.top - TOOLBAR_HEIGHT - 8)
 * 2. fallback: top < TOPBAR_BUFFER → 下方 (rect.bottom + 8)
 * 3. left 居中 selection (rect.left + rect.width/2 - toolbarWidth/2)
 *    + viewport clamp (≥ 8, ≤ window.innerWidth - toolbarWidth - 8)
 */
function computeToolbarPosition(rect: DOMRect, toolbarWidth: number): ComputedPosition {
  const aboveTop = rect.top - TOOLBAR_HEIGHT - VIEWPORT_PADDING;
  const belowTop = rect.bottom + VIEWPORT_PADDING;
  const placement: 'above' | 'below' = aboveTop < TOPBAR_BUFFER ? 'below' : 'above';
  const top = placement === 'above' ? aboveTop : belowTop;
  const centerLeft = rect.left + rect.width / 2 - toolbarWidth / 2;
  const maxLeft = window.innerWidth - toolbarWidth - VIEWPORT_PADDING;
  const left = Math.max(VIEWPORT_PADDING, Math.min(maxLeft, centerLeft));
  return { top, left, placement };
}

/**
 * 从当前 selection 取被覆盖的 mark id 集合 (用于 clear / remove).
 * 通过 anchor 找最近 [data-question-id], walk 选区内 <mark class="fb-hl"> 收集.
 */
function collectMarkIdsInSelection(
  questionId: string,
  range: Range,
): readonly string[] {
  const ancestor = range.commonAncestorContainer;
  const root =
    ancestor instanceof Element
      ? ancestor
      : ancestor.parentElement;
  if (root === null) return [];
  const card = root.closest(`[data-question-id="${CSS.escape(questionId)}"]`);
  if (card === null) return [];
  const marks = card.querySelectorAll<HTMLElement>('mark.fb-hl');
  const collected: string[] = [];
  marks.forEach((node) => {
    if (range.intersectsNode(node)) {
      const id = node.dataset.markId;
      if (id !== undefined && id !== '') collected.push(id);
    }
  });
  return collected;
}

export function SelectionToolbar({
  questionId,
  rect,
  onClose,
}: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<HTMLButtonElement[]>([]);
  const undoStackLen = useHighlightStore((s) => s.undoStack.length);
  const addMark = useHighlightStore((s) => s.addMark);
  const removeMarks = useHighlightStore((s) => s.removeMarks);
  const undo = useHighlightStore((s) => s.undo);

  // 工具条 width 默认 240 (4 swatch + 2 action + padding). 首次 mount 用估算,
  // 之后 measure 调整. position fixed 不影响 layout.
  const position = useMemo<ComputedPosition>(
    () => computeToolbarPosition(rect, 240),
    [rect],
  );

  // 命中色板 → 序列化 Range → addMark → 关闭工具条.
  const handlePickColor = useCallback(
    (colorKey: HighlightColorKey): void => {
      const selection = document.getSelection();
      if (selection === null || selection.rangeCount === 0) {
        onClose();
        return;
      }
      const range = selection.getRangeAt(0);
      const card = document.querySelector(
        `[data-question-id="${CSS.escape(questionId)}"]`,
      );
      if (card === null) {
        onClose();
        return;
      }
      const serialized = serializeSelection(card, range, questionId);
      if (serialized === null) {
        onClose();
        return;
      }
      const mark: Mark = {
        id: `mark-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`,
        questionId,
        textStart: serialized.textStart,
        textLength: serialized.textLength,
        colorKey,
        createdAt: Date.now(),
      };
      addMark(mark);
      selection.removeAllRanges();
      onClose();
    },
    [questionId, addMark, onClose],
  );

  // clear: 删除当前选区覆盖的 fb-hl mark.
  const handleClear = useCallback((): void => {
    const selection = document.getSelection();
    if (selection === null || selection.rangeCount === 0) {
      onClose();
      return;
    }
    const range = selection.getRangeAt(0);
    const ids = collectMarkIdsInSelection(questionId, range);
    if (ids.length > 0) {
      removeMarks(questionId, ids);
    }
    selection.removeAllRanges();
    onClose();
  }, [questionId, removeMarks, onClose]);

  const handleUndo = useCallback((): void => {
    undo();
  }, [undo]);

  // 键盘 Esc 关 + Left/Right 切按钮.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const focused = document.activeElement;
        if (
          focused === null ||
          !(focused instanceof HTMLButtonElement) ||
          !buttonRefs.current.includes(focused)
        ) {
          return;
        }
        event.preventDefault();
        const idx = buttonRefs.current.indexOf(focused);
        const delta = event.key === 'ArrowLeft' ? -1 : 1;
        const next =
          buttonRefs.current[
            (idx + delta + buttonRefs.current.length) % buttonRefs.current.length
          ];
        next.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // mount 时 measure 真实宽度 (估算 240 → 实测). top/left 重算.
  // jsdom 返回 0×0 → 跳过 (没有 layout 引擎, 用估算值更稳).
  useEffect(() => {
    const node = toolbarRef.current;
    if (node === null) return;
    const actualWidth = node.getBoundingClientRect().width;
    if (actualWidth <= 0) return; // jsdom / hidden parent
    if (Math.abs(actualWidth - 240) < 1) return; // 估算准, 跳
    const actualPos = computeToolbarPosition(rect, actualWidth);
    node.style.top = `${actualPos.top}px`;
    node.style.left = `${actualPos.left}px`;
  }, [rect]);

  if (typeof document === 'undefined') return null;

  const ariaLevelLabel = (level: 1 | 2 | 3 | 4): string => `L${level}`;

  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={PRACTICE_COPY.selectionAriaLabel}
      className={cn(
        'fixed z-40 flex items-center gap-1 px-2 py-1',
        'rounded-card border border-line-3 bg-surface shadow-pop',
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      data-testid="fb-selection-toolbar"
      data-placement={position.placement}
    >
      {SWATCH_ORDER.map((swatch, idx) => (
        <button
          key={swatch.key}
          ref={(node) => {
            if (node !== null) buttonRefs.current[idx] = node;
          }}
          type="button"
          onClick={() => handlePickColor(swatch.key)}
          aria-label={`${swatch.label} (${ariaLevelLabel(swatch.level)})`}
          className={cn(
            'fb-hl-swatch shrink-0 rounded-tiny border border-line w-8 h-8',
            'transition-[border-color,transform] duration-fast ease-motion',
            'hover:scale-105 active:scale-95 focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            `fb-hl-swatch--${swatch.key}`,
          )}
          data-testid={`fb-hl-swatch-${swatch.key}`}
        >
          <span className="sr-only">{`${swatch.label} L${swatch.level}`}</span>
        </button>
      ))}
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
      <button
        ref={(node) => {
          if (node !== null) buttonRefs.current[SWATCH_ORDER.length] = node;
        }}
        type="button"
        onClick={handleClear}
        aria-label={PRACTICE_COPY.selectionClear}
        className={cn(
          'shrink-0 inline-flex items-center justify-center rounded-tiny',
          'border border-line bg-transparent text-ink-3 w-8 h-8',
          'hover:bg-surface-alt hover:text-ink hover:border-line-3',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'focus-visible:ring-offset-2',
        )}
        data-testid="fb-hl-clear"
      >
        <TrashIcon size={16} />
      </button>
      <button
        ref={(node) => {
          if (node !== null) buttonRefs.current[SWATCH_ORDER.length + 1] = node;
        }}
        type="button"
        onClick={handleUndo}
        disabled={undoStackLen === 0}
        aria-label="撤销划线"
        className={cn(
          'shrink-0 inline-flex items-center justify-center rounded-tiny',
          'border border-line bg-transparent text-ink-3 w-8 h-8',
          'hover:bg-surface-alt hover:text-ink hover:border-line-3',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'focus-visible:ring-offset-2',
        )}
        data-testid="fb-hl-undo"
      >
        <ActionUndoIcon size={16} />
      </button>
    </div>,
    document.body,
  );
}
