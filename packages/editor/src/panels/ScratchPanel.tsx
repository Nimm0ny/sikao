import { useRef, useState } from 'react';
import { NavSubmitIcon, PenIcon, XCloseIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import { cn } from '@sikao/shared-utils';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { scratchChars } from '@sikao/answer-engine/word-limit/bodyChars';

// ScratchPanel — ruled notebook on the right edge. Accepts plain-text
// drops (highlight chips from the materials wide rail land here in PR7)
// and inserts at the textarea's caret position when focused, otherwise
// appends to the end. Clicking 「导入答题卡」 dumps the current scratch
// into the active question's text with first-line indents.

const PLACEHOLDER = '立意 · 分论点\n例子 · 数据\n结构 · 金句…';

export function ScratchPanel() {
  const scratch = useExamSession((s) => s.scratch);
  const setScratch = useExamSession((s) => s.setScratch);
  const appendScratchToSheet = useExamSession((s) => s.appendScratchToSheet);

  const taRef = useRef<HTMLTextAreaElement>(null);
  // Serialise drops — between a setScratch and React's commit-to-DOM, the
  // textarea's `value` and `selectionStart` lag the store. A second drop
  // arriving in that window would compute its insertion offset against the
  // OLD textarea value but apply against the NEW store string, garbling
  // the result. droppingRef holds back any drop that lands while a prior
  // one is still settling; the queued payload runs in the next RAF.
  const droppingRef = useRef(false);
  const [dropHover, setDropHover] = useState(false);
  const charCount = scratchChars(scratch);
  const canImport = scratch.trim().length > 0;

  const performDrop = (dropped: string) => {
    const ta = taRef.current;
    if (ta && ta === document.activeElement && typeof ta.selectionStart === 'number') {
      // Read the latest store value via getState() so we don't race the
      // closure-captured `scratch` snapshot.
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const current = useExamSession.getState().scratch;
      const before = current.slice(0, start);
      const after = current.slice(end);
      const needLeading = before.length > 0 && !/\n$/.test(before);
      const needTrailing = after.length > 0 && !/^\n/.test(after);
      const insert = (needLeading ? '\n' : '') + dropped + (needTrailing ? '\n' : '');
      const caret = before.length + insert.length;
      setScratch(before + insert + after);
      requestAnimationFrame(() => {
        const taNow = taRef.current;
        if (!taNow) return;
        taNow.selectionStart = caret;
        taNow.selectionEnd = caret;
        taNow.focus();
        droppingRef.current = false;
      });
    } else {
      const current = useExamSession.getState().scratch;
      setScratch(current ? current.replace(/\s+$/, '') + '\n' + dropped : dropped);
      window.setTimeout(() => {
        taRef.current?.focus();
        droppingRef.current = false;
      }, 0);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const dropped = e.dataTransfer.getData('text/plain');
    if (!dropped) return;
    e.preventDefault();
    setDropHover(false);
    if (droppingRef.current) {
      // Another drop is mid-flight — defer this one to the next RAF so it
      // sees the committed textarea value and selection.
      requestAnimationFrame(() => performDrop(dropped));
      return;
    }
    droppingRef.current = true;
    performDrop(dropped);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!dropHover) setDropHover(true);
    }
  };

  return (
    <aside
      className="h-full bg-[var(--exam-paper)] border-l border-line min-w-0 flex flex-col"
      data-testid="exam-scratch-panel"
    >
      <div className="px-4 py-3 border-b border-line bg-surface flex items-center gap-2 shrink-0">
        <PenIcon className="w-3 h-3 text-accent" />
        <span className="text-xs font-semibold text-ink tracking-wide">草稿</span>
        <span className="text-tiny text-ink-4">不计入作答</span>
        <div className="flex-1" />
        {canImport && (
          <Tooltip label="追写到答题卡">
            <button
              type="button"
              onClick={appendScratchToSheet}
              aria-label="导入答题卡"
              className={cn(
                'inline-flex items-center gap-1 px-2 py-px',
                'border border-accent/30 bg-accent-50 text-accent rounded-tiny',
                'text-tiny font-semibold cursor-pointer',
              )}
              data-testid="exam-scratch-import-btn"
            >
              <NavSubmitIcon className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
        {scratch.length > 0 && (
          <Tooltip label="清空草稿">
            <button
              type="button"
              onClick={() => setScratch('')}
              aria-label="清空草稿"
              className="text-xs text-ink-4 cursor-pointer"
              data-testid="exam-scratch-clear-btn"
            >
              <XCloseIcon className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* a11y: drag-drop target region. 子 textarea 自带 a11y (keyboard 输入主入口),
          drag/drop 是 mouse-only enhancement. role="region" + aria-label 给 screen reader
          可识别区域. region 是 noninteractive landmark, plugin 把 drag handler 算
          noninteractive-element-interactions, 行级 escape. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDropHover(false)}
        role="region"
        aria-label="草稿拖放区"
        className={cn(
          'flex-1 relative bg-surface overflow-hidden',
          'transition-[outline-color] duration-base',
        )}
        style={{
          padding: '14px 18px 14px 22px',
          outline: dropHover ? '2px dashed var(--accent-1)' : '0',
          outlineOffset: -4,
        }}
        data-testid="exam-scratch-droparea"
      >
        <div
          aria-hidden
          className="absolute top-0 bottom-0"
          style={{ left: 14, width: 1, background: 'var(--exam-binding)', opacity: 0.8 }} /* hardcode-allow: 14px ruled-line offset matches the lineHeight=28 alignment */
        />
        {dropHover && (
          <div className="absolute inset-2 pointer-events-none rounded-card-lg flex items-center justify-center">
            <div className="text-xs text-accent font-semibold px-3 py-px bg-surface rounded-pill border border-accent/30">
              松开以追加到草稿
            </div>
          </div>
        )}
        <textarea
          ref={taRef}
          value={scratch}
          onChange={(e) => setScratch(e.target.value)}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          aria-label="草稿便签输入区"
          className="w-full h-full border-0 p-0 outline-none bg-transparent resize-none font-serif"
          style={{
            fontFamily: '"Kaiti SC","STKaiti","KaiTi","楷体","Source Serif 4",serif',
            fontSize: 15,
            lineHeight: '28px',
            color: 'var(--exam-ink)',
            backgroundImage:
              'repeating-linear-gradient(transparent, transparent 27px, var(--exam-ruled) 27px, var(--exam-ruled) 28px)',
            backgroundSize: '100% 28px',
            backgroundPosition: '0 0',
          }}
          data-testid="exam-scratch-textarea"
        />
      </div>

      <div className="px-4 py-2 text-tiny text-ink-4 border-t border-line bg-[var(--exam-paper)] shrink-0 font-mono flex justify-between items-center">
        <span data-testid="exam-scratch-charcount">{charCount} 字</span>
        <span className="text-line-3">auto-save</span>
      </div>
    </aside>
  );
}
