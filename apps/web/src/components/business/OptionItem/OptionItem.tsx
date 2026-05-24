import styles from './OptionItem.module.css';

/*
 * OptionItem — V5 D.3.28 business component (skeleton).
 *
 * Why: question-option ABCD primitive. Per design.md §D.3.28 + §D.3.12 note,
 *      普通 Radio MUST NOT be used to model answer options — visual weight,
 *      review-mode behavior and a11y semantics differ. The 6 states encode
 *      both answering (rest / selected / disabled) and review (correct /
 *      wrong / reviewing) phases:
 *
 *      - rest      — pre-answer, neutral surface.
 *      - selected  — user has selected this option (pre-submit).
 *      - correct   — review: this option IS the correct answer.
 *      - wrong     — review: user selected this and it's wrong.
 *      - disabled  — not clickable.
 *      - reviewing — review mode + this option is the user's wrong pick;
 *                    the rest of the option list will simultaneously show a
 *                    sibling at state="correct" (so the user sees both
 *                    "what I picked" and "what was right"). State is a
 *                    single field; reviewing is independent — never compose.
 */

export type OptionItemState =
  | 'rest'
  | 'selected'
  | 'correct'
  | 'wrong'
  | 'disabled'
  | 'reviewing';

export interface OptionItemProps {
  readonly label: string;
  readonly text: string;
  readonly state: OptionItemState;
  readonly onClick?: () => void;
  readonly showLetter?: boolean;
  readonly showExplanation?: boolean;
  readonly explanation?: string;
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const STATES_WITH_CORRECT_GLYPH = new Set<OptionItemState>(['correct']);
const STATES_WITH_WRONG_GLYPH = new Set<OptionItemState>(['wrong', 'reviewing']);

export function OptionItem({
  label,
  text,
  state,
  onClick,
  showLetter = true,
  showExplanation,
  explanation,
}: OptionItemProps) {
  const isDisabled = state === 'disabled';
  // reviewing implicitly enables explanation — review surfaces context for the
  // wrong pick. Callers can still override via showExplanation=false.
  const explanationVisible =
    explanation !== undefined &&
    (showExplanation ?? state === 'reviewing');

  return (
    <button
      type="button"
      className={styles.root}
      data-state={state}
      data-testid="option-item"
      disabled={isDisabled}
      aria-pressed={state === 'selected'}
      onClick={() => {
        if (!isDisabled && onClick) onClick();
      }}
    >
      {showLetter ? (
        <span className={styles.letter} aria-hidden="true" data-testid="option-item-letter">
          {label}
        </span>
      ) : null}
      <span className={styles.body}>
        <span className={styles.text}>{text}</span>
        {explanationVisible ? (
          <span className={styles.explanation} data-testid="option-item-explanation">
            {explanation}
          </span>
        ) : null}
      </span>
      {STATES_WITH_CORRECT_GLYPH.has(state) ? (
        <span className={styles.glyph} data-glyph="correct">
          <CheckGlyph />
        </span>
      ) : null}
      {STATES_WITH_WRONG_GLYPH.has(state) ? (
        <span className={styles.glyph} data-glyph="wrong">
          <CloseGlyph />
        </span>
      ) : null}
    </button>
  );
}
