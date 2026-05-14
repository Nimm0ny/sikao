import { useCallback, useId, type ReactElement } from 'react';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';

// ShenlunSession/TypedEditor (PR13 P3, 2026-05-13) — 键盘 textarea 编辑器.
//
// Spec SSOT: docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §2.6
// + plan docs/plan/sikao-shenlun-dual-mode-pr13.md §6.
//
// 设计:
//   - dumb 组件: 不读 zustand store / 不调 API. value + onChange 由 shell 持有,
//     P5 wire BE 时 shell 接 useEssayDraft mutation, 这里不动. 跟 EditorPanel
//     (耦合 useExamSession) 的关键差异是这里**不耦合** essay-exam store, 让
//     ShenlunSession 跟旧 essay-exam 完全解耦.
//   - 不内部算字数: 字数显示在 TopBar (P2 已 ship), shell 用 bodyChars 算后
//     传给 TopBar.currentWordCount. 编辑器不重复显示.
//   - 不实现 drag-to-cite / 笔记按钮 / 清空按钮: 那是 EditorPanel 高耦合范围,
//     P4 + 后续 slice 再做.
//
// a11y (frontend/CLAUDE.md §3.7 表单 label 政策硬约束):
//   textarea 必须有 visible label. 这里用 aria-labelledby 指向 header 内 visible
//   <h2> 节点 (questionLabel + questionStem 渲染为可见 label), 不用 placeholder
//   替代 label.

export interface TypedEditorProps {
  readonly questionId: string;
  readonly questionLabel: string;
  readonly questionStem: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly maxWordCount: number;
  readonly className?: string;
}

export default function TypedEditor({
  questionId,
  questionLabel,
  questionStem,
  value,
  onChange,
  maxWordCount,
  className,
}: TypedEditorProps): ReactElement {
  // useId 兜底跨 SSR 同步, 但本组件父链 SSR 已 throw; 这里用 useId 主要为多实例
  // 同 questionId 时 (跨 portrait/landscape 共存场景) 也能拿到独立 DOM id.
  const reactId = useId();
  const headerDomId = `shenlun-question-stem-${questionId}-${reactId}`;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      onChange(e.target.value);
    },
    [onChange],
  );

  // 当 stem === label 时只渲染 label (避免重复 "题目三 / 题目三" 视觉冗余).
  // P5 BE 接入后 stem 是真实题干长文 ≠ label, 自动两行渲染.
  const showStem = questionStem.trim() !== '' && questionStem !== questionLabel;

  return (
    <section
      data-testid="shenlun-typed-editor"
      data-question-id={questionId}
      className={cn('flex flex-col min-h-0 overflow-hidden', className)}
    >
      <header
        id={headerDomId}
        className="px-6 py-3 border-b border-line-1 shrink-0 bg-paper-1"
        data-testid="shenlun-typed-editor-header"
      >
        <h2
          className="font-serif text-ink"
          style={{ fontSize: 18, lineHeight: 1.4 }} /* hardcode-allow: spec §2.6 题号 18 介于 --t-h3 与 --t-body */
        >
          {questionLabel}
        </h2>
        {showStem ? (
          <p
            className="font-serif text-ink-2 mt-1"
            style={{ fontSize: 14, lineHeight: 1.6 }} /* hardcode-allow: --t-body 14 题干说明 */
          >
            {questionStem}
          </p>
        ) : null}
      </header>
      <textarea
        id={`shenlun-typed-editor-textarea-${questionId}`}
        name={`shenlun-typed-editor-textarea-${questionId}`}
        aria-labelledby={headerDomId}
        value={value}
        onChange={handleChange}
        spellCheck={false}
        maxLength={maxWordCount > 0 ? maxWordCount * 2 : undefined}
        placeholder={ESSAY_SIKAO_COPY.typedEditorPlaceholder}
        data-testid="shenlun-typed-editor-textarea"
        className="flex-1 min-h-0 w-full px-6 py-5 font-serif text-ink bg-paper-1 outline-none resize-none"
        style={{
          fontSize: 'var(--read-fs, 17px)',
          lineHeight: 'var(--read-lh, 1.78)',
        }}
      />
    </section>
  );
}
