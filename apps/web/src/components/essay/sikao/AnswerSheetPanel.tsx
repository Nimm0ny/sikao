import { useCallback, useMemo, useRef, useState } from 'react';
import { layoutText } from '@sikao/answer-engine/grid-layout/gridLayout';
import { bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy/essay-sikao';

function formatSavedTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeRequirement(text: string): string {
  return text.replace(/\s/g, '');
}

function buildQuestionDescription(
  requirements: readonly string[],
  maxWords: number | undefined,
): string {
  if (requirements.length === 0) return '';
  if (maxWords === undefined) return requirements.join(' ');
  const wordLimitNeedle = `不超过${maxWords}字`;
  const lines = requirements.filter((line, index) => {
    const normalized = normalizeRequirement(line);
    if (normalized !== wordLimitNeedle) return true;
    return !requirements
      .slice(0, index)
      .some((prev) => normalizeRequirement(prev).includes(wordLimitNeedle));
  });
  return lines.join(' ');
}

export function AnswerSheetPanel() {
  const paper = useExamSession((s) => s.paper);
  const currentQ = useExamSession((s) => s.currentQ);
  const textsByQ = useExamSession((s) => s.textsByQ);
  const savedAt = useExamSession((s) => s.savedAt);
  const gridFontSize = useExamSession((s) => s.gridFontSize);
  const setText = useExamSession((s) => s.setText);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caretPos, setCaretPos] = useState(0);

  const question = paper?.questions[currentQ];
  const text = textsByQ[currentQ] ?? '';
  const written = useMemo(() => bodyChars(text), [text]);
  const targetWords = question?.maxWords ?? question?.minWords ?? 0;
  const layout = useMemo(
    () => layoutText(text, Math.max(question?.minWords ?? 0, 1)),
    [question?.minWords, text],
  );
  const caretLayout = useMemo(
    () => layoutText(text.slice(0, caretPos), Math.max(question?.minWords ?? 0, 1)),
    [caretPos, question?.minWords, text],
  );

  const updateCaret = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setCaretPos(textarea.selectionStart);
  }, []);

  if (!question) return null;
  const description =
    question.requirements.length > 0
      ? buildQuestionDescription(question.requirements, question.maxWords)
      : question.body;

  return (
    <section
      className="essay-answer-panel-proto flex flex-col min-h-0 overflow-hidden"
      data-testid="essay-answer-panel"
    >
      <header className="essay-question-header-proto">
        <div className="essay-question-title-row">
          <h3 className="essay-question-title">{question.title}</h3>
        </div>
        <p className="essay-question-body">{description}</p>
      </header>

      <div
        className="essay-answer-sheet flex-1 min-h-0 overflow-y-auto"
        data-testid="essay-answer-sheet"
      >
        <textarea
          id="essay-answer-sheet-input"
          name="essayAnswer"
          ref={textareaRef}
          value={text}
          onChange={(event) => {
            setText(currentQ, event.target.value);
            setCaretPos(event.target.selectionStart);
          }}
          onSelect={updateCaret}
          onKeyUp={updateCaret}
          spellCheck={false}
          aria-label={`${ESSAY_SIKAO_COPY.answerInputLabel}：${question.title}`}
          data-testid="essay-answer-sheet-input"
          className="essay-answer-sheet__input"
        />
        <div className="essay-answer-sheet__pages" aria-hidden="true">
          {layout.placedByPage.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="essay-answer-page"
              style={{ fontSize: gridFontSize }}
              data-testid={`essay-answer-page-${pageIndex + 1}`}
            >
              {page.map((cell, index) => (
                <span
                  key={`${pageIndex}-${cell.row}-${cell.col}-${index}`}
                  className="essay-answer-cell"
                  style={{
                    gridRow: cell.row + 1,
                    gridColumn: cell.col + 1,
                  }}
                >
                  {cell.char}
                </span>
              ))}
              {pageIndex === caretLayout.cursorPage ? (
                <span
                  className="essay-answer-caret"
                  style={{
                    gridRow: caretLayout.cursorRowInPage + 1,
                    gridColumn: caretLayout.cursorCol + 1,
                  }}
                  data-row={caretLayout.cursorRowInPage}
                  data-col={caretLayout.cursorCol}
                  data-testid="essay-answer-sheet-caret"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <footer className="essay-answer-footer-proto">
        <span className="essay-answer-save">
          <span>{ESSAY_SIKAO_COPY.answerAutosaveLabel}</span>
          <span className="tabular-nums">{formatSavedTime(savedAt)}</span>
        </span>
        <span
          className="essay-answer-footer-count tabular-nums"
          data-testid="essay-answer-sheet-wordcount"
        >
          {written}
          {targetWords > 0 ? ` / ${targetWords}` : ' 字'}
        </span>
      </footer>
    </section>
  );
}
