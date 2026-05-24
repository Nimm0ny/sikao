import type { ReactNode } from 'react';
import { Badge } from '../../atom/Badge';
import styles from './QuestionStem.module.css';

/*
 * QuestionStem — V5 D.3.29 business component (skeleton).
 *
 * Why: question prose container with metadata header (number / type /
 *      difficulty badge) and a font-size dial driven by D.3.15 Slider
 *      (steps 14 / 15 / 17 / 19). enableSelection wires the placeholder
 *      hook for word-selection annotation; actual highlight rendering
 *      lives in the dedicated annotation spec (R2/Q5). marks prop placeholder
 *      is rendered as a list under the prose — concrete in-text overlay
 *      ships with the annotation engine.
 */

export type QuestionStemFontSize = 14 | 15 | 17 | 19;
export type QuestionStemDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionStemMark {
  readonly start: number;
  readonly end: number;
  readonly color: string;
}

export interface QuestionStemProps {
  readonly number: number | string;
  readonly type?: string;
  readonly difficulty?: QuestionStemDifficulty;
  readonly content: ReactNode;
  readonly fontSize?: QuestionStemFontSize;
  readonly enableSelection?: boolean;
  readonly marks?: ReadonlyArray<QuestionStemMark>;
}

const DIFFICULTY_LABEL: Record<QuestionStemDifficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const DIFFICULTY_VARIANT: Record<
  QuestionStemDifficulty,
  'ok' | 'warn' | 'err'
> = {
  easy: 'ok',
  medium: 'warn',
  hard: 'err',
};

export function QuestionStem({
  number,
  type,
  difficulty,
  content,
  fontSize = 15,
  enableSelection = false,
  marks,
}: QuestionStemProps) {
  return (
    <article
      className={styles.root}
      data-font-size={fontSize}
      data-selectable={enableSelection || undefined}
      data-testid="question-stem"
    >
      <header className={styles.meta}>
        <span className={styles.number}>{number}.</span>
        {type !== undefined ? <span className={styles.type}>{type}</span> : null}
        {difficulty !== undefined ? (
          <Badge variant={DIFFICULTY_VARIANT[difficulty]} size="sm">
            {DIFFICULTY_LABEL[difficulty]}
          </Badge>
        ) : null}
      </header>
      <div className={styles.content} data-testid="question-stem-content">
        {content}
      </div>
      {marks !== undefined && marks.length > 0 ? (
        <ul className={styles.markList} data-testid="question-stem-marks" aria-label="标注">
          {marks.map((m, i) => (
            <li key={`${m.start}-${m.end}-${i}`} className={styles.mark}>
              {m.start}–{m.end}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
