import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormatBoldIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { CELL, COLS, layoutText } from '@sikao/answer-engine/grid-layout/gridLayout';
import { allChars, bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';
import { getWordLimitTarget } from '@sikao/answer-engine/word-limit/wordLimits';
import { GridPaper } from '../pieces/GridPaper';
import { Pager } from '../pieces/Pager';
import { WordRuler } from '../pieces/WordRuler';

// AnswerArea — center pane. Composes paginated 田字格 + floating Pager +
// font-size chip + WordRuler, with a fixed-but-invisible textarea capturing
// keystrokes. Enter inserts \n + two full-width spaces (first-line indent).
//
// Cursor follows the user as they type (autoFollow=true). Clicking a Pager
// chip that's not the cursor's page disables auto-follow until the cursor
// returns to the viewed page.
//
// The 题干 lives entirely in TopBar's peek popover now (E2E #7) — double-
// click a QuestionRing to pin it.

export function AnswerArea() {
  const paper = useExamSession((s) => s.paper);
  const phase = useExamSession((s) => s.phase);
  const currentQ = useExamSession((s) => s.currentQ);
  const text = useExamSession((s) => s.textsByQ[currentQ] ?? '');
  const setText = useExamSession((s) => s.setText);
  const gridFontSize = useExamSession((s) => s.gridFontSize);
  const bumpGridFontSize = useExamSession((s) => s.bumpGridFontSize);

  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const [focused, setFocused] = useState(false);
  // rawViewPage drives navigation; viewPage clamps to [0, pageCount-1] each
  // render so we don't need a clamping effect (and dodge the
  // react-hooks/set-state-in-effect lint).
  const [rawViewPage, setRawViewPage] = useState(0);

  const paused = phase !== 'running';
  const written = useMemo(() => bodyChars(text), [text]);
  const withPunct = useMemo(() => allChars(text), [text]);
  // P1-5: 把 targetWords 算在 hook 内部, 避免在组件 body 顶层维护一份
  // optional `question` + `0`-fallback `targetWords` (历史叠加产物). 数据 narrow
  // 在下方早 return 后由 `activeQuestion` 唯一持有.
  const layout = useMemo(() => {
    const q = paper?.questions[currentQ];
    const target = q ? getWordLimitTarget(q) : 0;
    return layoutText(text, target);
  }, [text, paper, currentQ]);
  const { placedByPage, cursorPage, cursorRowInPage, cursorCol, pageCount } = layout;

  const viewPage = Math.min(Math.max(0, pageCount - 1), Math.max(0, rawViewPage));

  // Cursor → view follow. Re-enabled the moment the cursor crosses back to
  // the user-clicked viewPage.
  useEffect(() => {
    if (autoFollowRef.current) setRawViewPage(cursorPage);
  }, [cursorPage]);

  useEffect(() => {
    // Page 0 is already at the scroller top — scrolling there would push the
    // QuestionCard above it out of view. Only re-position when viewPage > 0.
    // Using scroller.scrollTo (not Element.scrollIntoView) keeps the scroll
    // contained — scrollIntoView walks scroll ancestors and would yank the
    // outer page too, which broke the chrome --headless self-verify.
    if (viewPage === 0) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector<HTMLElement>(`[data-page="${viewPage}"]`);
    if (el) {
      scroller.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
    }
  }, [viewPage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart ?? text.length;
        const end = ta.selectionEnd ?? text.length;
        // \n + 全角两格 → first-line indent for the new paragraph
        const next = text.slice(0, start) + '\n　　' + text.slice(end);
        setText(currentQ, next);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 3;
        });
      }
    },
    [text, currentQ, setText],
  );

  const focusInput = useCallback(() => {
    if (paused) return;
    hiddenInputRef.current?.focus();
    setFocused(true);
  }, [paused]);

  const goPage = useCallback(
    (page: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, page));
      autoFollowRef.current = clamped === cursorPage;
      setRawViewPage(clamped);
    },
    [pageCount, cursorPage],
  );

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const pages = Array.from(scroller.querySelectorAll<HTMLElement>('[data-page]'));
    let best = 0;
    let bestVisible = -Infinity;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    for (const el of pages) {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      const visible = Math.max(0, Math.min(bottom, viewBottom) - Math.max(top, viewTop));
      if (visible > bestVisible) {
        bestVisible = visible;
        const dataPage = el.dataset.page;
        if (dataPage) best = parseInt(dataPage, 10);
      }
    }
    if (best !== viewPage) {
      autoFollowRef.current = best === cursorPage;
      setRawViewPage(best);
    }
  }, [cursorPage, viewPage]);

  if (!paper) return null;
  const activeQuestion = paper.questions[currentQ];
  if (activeQuestion === undefined) {
    throw new Error(`AnswerArea: currentQ ${currentQ} out of bounds for paper ${paper.code}`);
  }

  return (
    <div className="h-full bg-surface-alt min-w-0 flex flex-col relative">
      {/* a11y: scroller wrapper. onClick={focusInput} 是 textarea 抢焦 helper, 是
          presentation-only wrapper, 子 GridPaper/textarea 自带 a11y. role 与
          tabIndex 都不合适 (会导致 Tab 序错位), 行级 escape. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onClick={focusInput}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 min-h-0"
        style={{ scrollBehavior: 'smooth', paddingBottom: 80, cursor: paused ? 'not-allowed' : 'text' }}
        data-testid="exam-answerarea-scroller"
      >
        <div className="mx-auto" style={{ maxWidth: COLS * CELL + 48 }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <GridPaper
              key={i}
              pageIdx={i}
              pageCount={pageCount}
              cells={placedByPage[i] ?? []}
              cursorRowInPage={cursorRowInPage}
              cursorCol={cursorCol}
              isCursorPage={i === cursorPage}
              caretVisible={focused && !paused}
              gridFontSize={gridFontSize}
            />
          ))}
          {text.length === 0 && !focused && (
            <div className="text-center text-xs text-ink-4 mt-2">
              点击稿纸开始作答
            </div>
          )}
        </div>

        <textarea
          ref={hiddenInputRef}
          value={text}
          onChange={(e) => setText(currentQ, e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={paused}
          spellCheck={false}
          aria-label={`作答 — ${activeQuestion.no}：${activeQuestion.title}`}
          className="opacity-0 pointer-events-none resize-none"
          style={{ position: 'fixed', width: 1, height: 1 }}
          data-testid="exam-answerarea-hidden-input"
        />
      </div>

      {/* Font-size chip — absolute top-right of the answer pane so it floats
          above the scroller without contesting Pager's bottom anchor. Same
          A−/A+ shape as MaterialReader for muscle memory. */}
      <div
        className={cn(
          'absolute top-3 right-3 z-10',
          'flex items-center border border-line rounded-tiny overflow-hidden bg-surface shadow-card',
        )}
        data-testid="exam-answerarea-fontchip"
      >
        <Tooltip label="缩小答题卡字号">
          <button
            type="button"
            onClick={() => bumpGridFontSize(-1)}
            disabled={paused || gridFontSize <= 14}
            aria-label="缩小答题卡字号"
            className={cn(
              'w-7 h-7 text-xs font-bold transition-colors duration-base',
              gridFontSize <= 14 || paused
                ? 'text-line-3 cursor-not-allowed'
                : 'text-ink-3 hover:bg-surface-alt cursor-pointer',
            )}
            data-testid="exam-answerarea-font-down"
          >
            <FormatBoldIcon className="w-3 h-3" />
          </button>
        </Tooltip>
        <span className="w-px h-3.5 bg-line" aria-hidden /> {/* hardcode-allow: 14px hairline divider, sub-token */}
        <span
          className="w-7 text-center text-tiny text-ink-4 font-mono tabular-nums"
          data-testid="exam-answerarea-font-size"
        >
          {gridFontSize}
        </span>
        <span className="w-px h-3.5 bg-line" aria-hidden /> {/* hardcode-allow: matches divider above */}
        <Tooltip label="放大答题卡字号">
          <button
            type="button"
            onClick={() => bumpGridFontSize(1)}
            disabled={paused || gridFontSize >= 22}
            aria-label="放大答题卡字号"
            className={cn(
              'w-7 h-7 text-xs font-bold transition-colors duration-base',
              gridFontSize >= 22 || paused
                ? 'text-line-3 cursor-not-allowed'
                : 'text-ink-3 hover:bg-surface-alt cursor-pointer',
            )}
            data-testid="exam-answerarea-font-up"
          >
            <FormatBoldIcon className="w-3 h-3" />
          </button>
        </Tooltip>
      </div>

      {pageCount > 1 && (
        <Pager
          pageCount={pageCount}
          viewPage={viewPage}
          cursorPage={cursorPage}
          onGoTo={goPage}
        />
      )}

      <div className="px-5 pb-4 shrink-0">
        <WordRuler
          written={written}
          withPunct={withPunct}
          minWords={activeQuestion.minWords}
          maxWords={activeQuestion.maxWords}
        />
      </div>
    </div>
  );
}
