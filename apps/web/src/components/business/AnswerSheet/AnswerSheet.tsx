import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './AnswerSheet.module.css';

/*
 * AnswerSheet — V5 D.3.30 business component (skeleton).
 *
 * Why: bird's-eye answer-sheet grid for exam navigation. 4 cell states
 *      (unanswered / answered / marked / current) per design.md §D.3.30.
 *      Default cols=5 matches 行测 layout; cols=10 is the dense variant
 *      for paper-style summaries. Keyboard nav via ↑ ↓ ← → moves focus
 *      across grid cells (roving tabindex pattern); Enter/Space delegate
 *      to native button activation, which in turn fires onJump.
 */

export type AnswerSheetCellState =
  | 'unanswered'
  | 'answered'
  | 'marked'
  | 'current';

export interface AnswerSheetQuestion {
  readonly number: number;
  readonly state: AnswerSheetCellState;
}

export interface AnswerSheetProps {
  readonly questions: ReadonlyArray<AnswerSheetQuestion>;
  readonly cols?: number;
  readonly onJump: (number: number) => void;
  readonly 'aria-label'?: string;
}

function focusCell(
  refs: ReadonlyArray<HTMLButtonElement | null>,
  target: number,
) {
  const cell = refs[target];
  if (cell) cell.focus();
}

export function AnswerSheet({
  questions,
  cols = 5,
  onJump,
  'aria-label': ariaLabel = '答题卡',
}: AnswerSheetProps) {
  if (questions.length === 0) {
    throw new Error('AnswerSheet: `questions` must contain at least one entry');
  }
  if (cols < 1) {
    throw new Error(`AnswerSheet: \`cols\` must be >= 1 (got ${cols})`);
  }

  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'ArrowDown') next = index + cols;
    else if (event.key === 'ArrowUp') next = index - cols;
    if (next === null) return;
    if (next < 0 || next >= questions.length) return;
    event.preventDefault();
    focusCell(cellRefs.current, next);
  };

  return (
    <div
      className={styles.root}
      role="grid"
      aria-label={ariaLabel}
      data-testid="answer-sheet"
      data-cols={cols}
    >
      {questions.map((q, i) => (
        <button
          key={q.number}
          type="button"
          ref={(el) => {
            cellRefs.current[i] = el;
          }}
          className={styles.cell}
          data-state={q.state}
          data-testid={`answer-sheet-cell-${q.number}`}
          role="gridcell"
          aria-current={q.state === 'current' ? 'location' : undefined}
          aria-label={`第 ${q.number} 题 — ${LABELS[q.state]}`}
          tabIndex={q.state === 'current' ? 0 : -1}
          onClick={() => onJump(q.number)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        >
          {q.number}
        </button>
      ))}
    </div>
  );
}

const LABELS: Record<AnswerSheetCellState, string> = {
  unanswered: '未答',
  answered: '已答',
  marked: '已标记',
  current: '当前题',
};
