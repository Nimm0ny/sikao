import { cn } from '@sikao/shared-utils';

// SIKAO Phase 3 (2026-05-09): 章节式锚点 — Section 之间的 chapter label.
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md.
//
// 用途: section 切换时 visual cue. 完成度 (e.g. 5/11) 帮用户长滚动时定位.
//
// Dumb component, 无副作用.

export interface FbChapterLabelProps {
  /** "CHAPTER 01" / "PART 02" — 用 mono uppercase. */
  readonly numLabel: string;
  /** "言语理解" / "数量判断" — 中文 serif. */
  readonly title: string;
  /** "5 / 11" 已答完成度. 不传 = 不显示. */
  readonly completionLabel?: string;
}

export function FbChapterLabel({ numLabel, title, completionLabel }: FbChapterLabelProps) {
  return (
    <div
      className={cn(
        'relative my-12 flex flex-col items-center text-center gap-1',
        // 左右 hairline 装饰: 用绝对定位 + before/after 不行 (Tailwind 不友好),
        // 改用 flex + display:flex 三段 (line / content / line). 但目标是
        // semantic article: 用 div 居中 + h3 即可, 装饰线交给 ::before/after
        // 难以做 token-only Tailwind, 改用 inline div.
      )}
      role="separator"
      aria-label={`${numLabel} ${title}`}
      data-testid={`fb-chapter-${numLabel}`}
    >
      <div className="flex items-center gap-5 w-full justify-center">
        <span className="flex-1 max-w-16 h-px bg-line" aria-hidden="true" />
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-tiny tracking-widest uppercase text-ink-3">
            {numLabel}
          </span>
          <h3 className="font-serif text-h-card font-medium text-ink">{title}</h3>
        </div>
        <span className="flex-1 max-w-16 h-px bg-line" aria-hidden="true" />
      </div>
      {completionLabel !== undefined ? (
        <span className="font-mono text-tiny tracking-loose text-ink-3 mt-1 tabular-nums">
          {completionLabel}
        </span>
      ) : null}
    </div>
  );
}
