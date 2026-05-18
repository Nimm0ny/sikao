import { useMemo, useRef, useState } from 'react';
import { cn } from '@sikao/shared-utils';
import { Badge } from '@sikao/ui/ui';
import { FbActions } from './FbActions';
import { FbOpts } from './FbOpts';
import { FbTF } from './FbTF';
import { isTrueFalseQuestion } from './lib/isTrueFalseQuestion';
import { renderStemWithMarks } from './lib/renderStemWithMarks';
import { useHighlightStore, type Mark } from '@sikao/domain/xingce/useHighlightStore';
import { PRACTICE_COPY } from '@/lib/ui-copy';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';
// Wave 9 Phase 2a (2026-05-12): mobile media-query override (≤768) lives in
// fb-highlight.css. Import here so FbCard's .fb-card-responsive class is
// guaranteed to have the rule available without depending on SelectionToolbar
// being mounted.
import './fb-highlight.css';

// Stable empty reference for marks selector fallback — 避免 zustand selector
// 每 render 返回新 [] 触发 store rerender 死循环 (React 18+ useSyncExternalStore).
const EMPTY_MARKS: readonly Mark[] = Object.freeze([]);

// Current question card. The caller owns all session state; this component
// renders the question and action states it receives.
//
// SIKAO Phase P1 (2026-05-11): 重构为 72px 左列 grid + 30px serif 裸数字 (SPEC
// design/design_handoff_xingce_exam/SPEC.md §3.1-3.3 字符级对齐).

export interface FbCardProps {
  readonly question: QuestionDetailV2;
  readonly questionDisplayNo: number;
  readonly sectionTitle: string;
  readonly tags?: readonly string[];
  readonly isCurrent: boolean;
  readonly isAnswered: boolean;
  readonly selectedAnswers: readonly string[];
  readonly isFavorited: boolean;
  readonly isMarked: boolean;
  readonly hasNote: boolean;
  /** P5b/3: armed 态 (caller 点 🖋 后 1.2s pulse). animationend 由本组件清. */
  readonly armed?: boolean;
  readonly onAnswer: (questionId: string, optionKeys: string[]) => void;
  readonly onToggleFavorite: (questionId: string, next: boolean) => void;
  readonly onToggleMark: (questionId: string, next: boolean) => void;
  readonly onOpenNote: (questionId: string) => void;
  /** P5b/3: 点 🖋 → caller arm(qid) 启动 SelectionToolbar. */
  readonly onHighlightArm?: (questionId: string) => void;
}

export function FbCard({
  question,
  questionDisplayNo,
  sectionTitle,
  tags,
  isCurrent,
  isAnswered,
  selectedAnswers,
  isFavorited,
  isMarked,
  hasNote,
  armed,
  onAnswer,
  onToggleFavorite,
  onToggleMark,
  onOpenNote,
  onHighlightArm,
}: FbCardProps) {
  const qid = String(question.questionId);
  // P5b/2: stem 渲染从 dangerouslySetInnerHTML 切到 renderStemWithMarks
  // → 保留 sanitize chain + React 可控 <mark> 渲染.
  // 关键: 用 EMPTY_MARKS 常量 fallback, 避免每 render 新建 [] 触发 store rerender 死循环.
  const marks = useHighlightStore((s) => s.marks[qid] ?? EMPTY_MARKS);
  const stemNodes = useMemo(
    () => renderStemWithMarks(question.content.stem ?? '', marks),
    [question.content.stem, marks],
  );
  // P5b/3 armed mode: 1.2s pulse 后 animationend 清 class.
  const articleRef = useRef<HTMLElement | null>(null);
  const [pulsing, setPulsing] = useArmedPulse(armed);
  const options = question.content.options ?? [];
  const dimClass = !isCurrent && isAnswered ? 'opacity-90' : 'opacity-100';
  const questionType = question.questionKind === 'multiple_choice'
    ? PRACTICE_COPY.fbQuestionTypeMultiple
    : question.questionKind === 'true_false'
      ? PRACTICE_COPY.fbQuestionTypeTrueFalse
      : PRACTICE_COPY.fbQuestionTypeSingle;
  // Wave 9 Phase 2a (2026-05-12): desktop default 72px / 24px / 24px 0 padding
  // (spec design_handoff_xingce_exam §3.1 字符级). mobile (≤768) override via
  // .fb-card-responsive class + sikao-essay-adjacent CSS rule — 让 jsdom
  // 测试看到的 desktop inline style 不变 (preserves SPEC §3.1 contract test),
  // mobile 媒体查询走 CSS media rule.
  return (
    <article
      ref={articleRef}
      id={`fb-card-${qid}`}
      data-question-id={qid}
      data-current={isCurrent || undefined}
      data-answered={isAnswered || undefined}
      data-armed={pulsing || undefined}
      data-testid={`fb-card-${qid}`}
      className={cn(
        'fb-card fb-card-responsive relative grid min-h-[334px] gap-4',
        'rounded-card-lg border border-line bg-paper shadow-card',
        'px-5 py-6 transition-[border-color,opacity,box-shadow] duration-base ease-motion',
        'md:grid-cols-[32px_minmax(0,1fr)_auto]',
        'grid-cols-[28px_minmax(0,1fr)]',
        isCurrent && 'border-exam-accent shadow-pop',
        pulsing && 'is-armed',
        dimClass,
      )}
      onAnimationEnd={() => setPulsing(false)}
      aria-current={isCurrent ? 'true' : undefined}
    >
      <div className="pt-1">
        <span
          className={cn(
            'font-serif text-h3 font-semibold tabular-nums leading-none',
            isCurrent ? 'text-exam-accent' : 'text-ink-1',
          )}
          aria-label={`第 ${questionDisplayNo} 题`}
        >
          {questionDisplayNo}.
        </span>
      </div>
      <div className="min-w-0">
        <header className="mb-4 flex min-w-0 items-center gap-3">
          <Badge tone="brand" variant="chip">
            {questionType}
          </Badge>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-tiny tracking-eyebrow uppercase text-ink-3 truncate">
              {sectionTitle}
            </span>
            {tags && tags.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {tags.map((tag) => (
                  <Badge key={tag} tone="neutral" variant="chip">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </header>
        <div
          className="font-serif text-body font-semibold leading-relaxed text-ink mb-5"
          style={{ fontSize: 'var(--read-fs)', lineHeight: 'var(--read-lh)' }}
          data-testid={`fb-stem-${qid}`}
        >
          {stemNodes}
        </div>
        {isTrueFalseQuestion(question) ? (
          <FbTF
            questionId={qid}
            selected={selectedAnswers}
            onChange={onAnswer}
          />
        ) : (
          <FbOpts
            questionId={qid}
            options={options}
            selected={selectedAnswers}
            questionKind={question.questionKind}
            onChange={onAnswer}
          />
        )}
      </div>
      <div className="col-span-full flex justify-start md:col-span-1 md:justify-end">
        <FbActions
          questionId={qid}
          isFavorited={isFavorited}
          isMarked={isMarked}
          hasNote={hasNote}
          onToggleFavorite={onToggleFavorite}
          onToggleMark={onToggleMark}
          onOpenNote={onOpenNote}
          onHighlightArm={onHighlightArm}
          captureSourceQuote={extractStemPlainText(question.content.stem ?? '')}
          orientation="horizontal"
        />
      </div>
    </article>
  );
}

/**
 * P5b/3 armed pulse 本地 state hook.
 * armed prop = true → pulsing 进入 true (附 .is-armed CSS class + 1.2s animation).
 * onAnimationEnd 由调用方触发 setPulsing(false) 清 class.
 *
 * 用 render-body 同步 setState pattern (React 官方 derived-state-from-prop:
 * https://react.dev/reference/react/useState#storing-information-from-previous-renders).
 * armed: false→true edge 探测走 lastArmed ref. 不用 useEffect 避免 ESLint
 * react-hooks/set-state-in-effect 报错.
 */
function useArmedPulse(
  armed: boolean | undefined,
): readonly [boolean, (next: boolean) => void] {
  const [pulsing, setPulsing] = useState(false);
  const [lastArmed, setLastArmed] = useState<boolean>(false);
  const currentArmed = armed === true;
  if (currentArmed !== lastArmed) {
    // edge 探测: armed prop 变化 — 同步 schedule 下一 render.
    setLastArmed(currentArmed);
    if (currentArmed && !pulsing) {
      setPulsing(true);
    }
  }
  return [pulsing, setPulsing] as const;
}

/**
 * Wave 6E (2026-05-12): 题干 HTML → plain text 截断 100 char 给 NoteCaptureLauncher
 * 当 sourceQuote pre-fill. 不走 DOMPurify (那是渲染 sanitize), 这里只剥 tag +
 * collapse whitespace, 入 BE sourceQuote 字段是纯文本.
 */
function extractStemPlainText(html: string): string {
  if (html.length === 0) return '';
  const stripped = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length === 0) return '';
  if (stripped.length <= 100) return stripped;
  return `${stripped.slice(0, 100)}…`;
}
