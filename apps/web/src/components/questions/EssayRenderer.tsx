import { useMemo, useState, type ChangeEvent } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@sikao/shared-utils';
import { ESSAY_COPY } from '@/lib/ui-copy';
import type { EssayMetadata, QuestionDetailV2 } from '@sikao/api-client/types/api';

// Slice 2a — 申论 essay renderer (dumb, props-only).
//
// 职责:
//   - 题干 sanitize 后渲染 (stem, dangerouslySetInnerHTML + DOMPurify)
//   - 给定材料折叠展示 (默认折叠避免覆盖屏)
//   - 作答 textarea (字数计数器, 超限弱提示)
//
// 不做:
//   - submit (上层 PracticeSession / EssayPractice 走标准提交流程)
//   - LLM 评分 (Slice 2c BackgroundTask)
//
// 答案编码: store.answers[qid] = [fullEssayText] (length 0 当未答, length 1 当填了).
// 跟 fill_blank renderer 对齐.

interface Props {
  readonly question: QuestionDetailV2;
  readonly selectedAnswer: readonly string[];
  readonly onAnswerChange: (val: string[]) => void;
}

const EssayRenderer: React.FC<Props> = ({ question, selectedAnswer, onAnswerChange }) => {
  const sanitizedStem = useMemo(
    () => ({ __html: DOMPurify.sanitize(question.content.stem || '') }),
    [question.content.stem],
  );

  // Subagent review P1-1: 静态 id 在 MaterialGroupContainer 同时渲染多道 essay 时
  // 撞 id (label-htmlFor 失联 / aria-controls 误指). 用 questionId 唯一前缀.
  const qid = String(question.questionId);
  const answerInputId = `essay-answer-${qid}`;
  const materialsBodyId = `essay-materials-body-${qid}`;

  const meta: EssayMetadata = question.content.essayMetadata ?? {};
  // Subagent review P2-4: 后端类型契约说 string[], 但 ingest 不验 array shape;
  // misingest 给 string 时 `materials.length` 会返字符长度, `.map` 会炸. 防御.
  const materials = Array.isArray(meta.materialTexts) ? meta.materialTexts : [];

  // 切题时 textarea 同步从 store 拉值 (跟 FillBlankRenderer 对齐: 用 prevProp 模式
  // 而非 useEffect, 避免 react-hooks/set-state-in-effect lint).
  const initial = selectedAnswer[0] ?? '';
  const [prevInitial, setPrevInitial] = useState(initial);
  const [text, setText] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setText(initial);
  }

  const [materialsOpen, setMaterialsOpen] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value;
    setText(value);
    onAnswerChange(value.trim() === '' ? [] : [value]);
  };

  const charCount = text.length;
  const { wordLimitMin, wordLimitMax, suggestedMinutes, fullScore } = meta;
  const overLimit = wordLimitMax !== undefined && charCount > wordLimitMax;
  const underLimit =
    wordLimitMin !== undefined && charCount > 0 && charCount < wordLimitMin;

  return (
    <div className="mb-8" data-testid="essay-renderer">
      <div
        className="text-lg font-medium text-ink leading-relaxed mb-6"
        dangerouslySetInnerHTML={sanitizedStem}
      />

      {materials.length > 0 ? (
        <section
          className="mb-6 border border-line rounded-card bg-surface"
          data-testid="essay-materials"
        >
          <button
            type="button"
            className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-ink hover:bg-surface-hover transition-colors"
            onClick={() => setMaterialsOpen((open) => !open)}
            aria-expanded={materialsOpen}
            aria-controls={materialsBodyId}
            data-testid="essay-materials-toggle"
          >
            <span>
              {ESSAY_COPY.materialsTitle}
              <span className="ml-2 text-tiny font-mono text-ink-3 tracking-loose">
                {materials.length}
              </span>
            </span>
            <span className="text-tiny font-mono text-ink-3 tracking-loose">
              {materialsOpen ? ESSAY_COPY.materialsCollapse : ESSAY_COPY.materialsExpand}
            </span>
          </button>
          {materialsOpen ? (
            <div
              id={materialsBodyId}
              className="px-4 pb-4 pt-1 space-y-4 border-t border-line"
              data-testid="essay-materials-body"
            >
              {materials.map((md, idx) => (
                <div key={idx}>
                  <div className="text-tiny font-mono text-ink-3 tracking-loose mb-1">
                    {ESSAY_COPY.materialIndex(idx + 1)}
                  </div>
                  <p className="text-md text-ink leading-relaxed whitespace-pre-wrap">{md}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        <label
          htmlFor={answerInputId}
          className="text-sm font-medium text-ink tracking-[0.01em]" // hardcode-allow: form label fine-tune
        >
          {ESSAY_COPY.answerLabel}
        </label>
        {/* a11y: cross-node <label htmlFor> + <textarea id> 是 W3C 标准, plugin 不识别. */}
        {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
        <textarea
          id={answerInputId}
          value={text}
          onChange={handleChange}
          placeholder={ESSAY_COPY.answerPlaceholder}
          rows={12}
          className={cn(
            'w-full px-3 py-3 rounded-card',
            'font-sans text-md text-ink leading-relaxed bg-transparent',
            'border outline-none resize-y',
            'transition-colors duration-fast ease-motion',
            'placeholder:text-line-3',
            overLimit
              ? 'border-warn focus:border-warn'
              : 'border-line hover:border-line-3 focus:border-ink',
          )}
          data-testid="essay-answer-input"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-tiny font-mono tracking-loose">
          <span
            className={overLimit ? 'text-warn' : 'text-ink-3'}
            data-testid="essay-word-count"
          >
            {ESSAY_COPY.wordCountFmt(charCount)}
          </span>
          {wordLimitMin !== undefined || wordLimitMax !== undefined ? (
            <span className="text-ink-3" data-testid="essay-word-range">
              {ESSAY_COPY.wordRangeFmt(wordLimitMin, wordLimitMax)}
            </span>
          ) : null}
          {overLimit ? (
            <span className="text-warn" data-testid="essay-word-warn-over">
              {ESSAY_COPY.wordCountOver}
            </span>
          ) : underLimit ? (
            <span className="text-ink-3" data-testid="essay-word-warn-under">
              {ESSAY_COPY.wordCountUnder}
            </span>
          ) : null}
          {suggestedMinutes !== undefined ? (
            <span className="text-ink-3">
              {ESSAY_COPY.suggestedTimeFmt(suggestedMinutes)}
            </span>
          ) : null}
          {fullScore !== undefined ? (
            <span className="text-ink-3">{ESSAY_COPY.fullScoreFmt(fullScore)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EssayRenderer;
