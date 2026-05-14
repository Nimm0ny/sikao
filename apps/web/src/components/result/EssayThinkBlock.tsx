import { Fragment, type ReactNode } from 'react';
import { splitTextWithHighlights } from './_essayResultHelpers';

// SIKAO Wave 2 Phase 3 — hifi 05b "AI 思考" think block (Fixer D).
//
// 视觉 spec (design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 3020-3024):
//   .think margin-top 40px / padding 24px 26px / bg var(--paper-2) /
//          border 1px var(--line-2) / grid auto/1fr / gap 22px
//   .think .tag (mono 10px var(--accent-1) + border var(--accent-1) padding 4px 8px
//                tracking-widest) — "AI · 思考"
//   .think h4 (serif 18px weight 500)
//   .think p  (serif 14px lh 1.75 var(--ink-2))
//   .think p mark (background var(--accent-50) + border-bottom var(--accent-1))
//
// CTA hint 行 (e.g. "可以在右栏 → 进入'引用专项'5 题训练") 用 footer slot
// 自由 ReactNode (caller 决定按钮/链接 — 跟数据/路由解耦).

export interface EssayThinkBlockProps {
  /** tag 标签文案, 默认 'AI · 思考' */
  readonly tag?: string;
  /** h4 大标 */
  readonly title: string;
  /** 多段正文 (每段 1 个 string). mark 高亮通过 highlights 指定. */
  readonly paragraphs: readonly string[];
  /** mark 高亮关键词 (作用于所有段). 空数组 → 不高亮. */
  readonly highlights?: readonly string[];
  /** 底部 CTA / 提示行 ReactNode slot (可选) */
  readonly footer?: ReactNode;
  /** data-testid 前缀, 默认 'essay-think-block' */
  readonly testIdPrefix?: string;
  readonly className?: string;
}

function renderHighlightedText(text: string, highlights: readonly string[]) {
  const parts = splitTextWithHighlights(text, highlights);
  return parts.map((p, i) =>
    p.isMark ? (
      <mark
        key={i}
        style={{
          backgroundColor: 'var(--accent-50)',
          padding: '0 3px',
          borderBottom: '1px solid var(--accent-1)',
          color: 'var(--ink-1)',
        }}
      >
        {p.chunk}
      </mark>
    ) : (
      <Fragment key={i}>{p.chunk}</Fragment>
    ),
  );
}

export function EssayThinkBlock({
  tag = 'AI · 思考',
  title,
  paragraphs,
  highlights = [],
  footer,
  testIdPrefix = 'essay-think-block',
  className,
}: EssayThinkBlockProps) {
  return (
    <div
      className={className}
      style={{
        marginTop: '40px',
        padding: '24px 26px',
        backgroundColor: 'var(--paper-2)',
        border: '1px solid var(--line-2)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '22px',
      }}
      data-testid={testIdPrefix}
    >
      <span
        className="font-mono uppercase"
        style={{
          fontSize: '10px',
          color: 'var(--accent-1)',
          border: '1px solid var(--accent-1)',
          padding: '4px 8px',
          letterSpacing: 'var(--tracking-widest)',
          alignSelf: 'start',
        }}
        data-testid={`${testIdPrefix}-tag`}
      >
        {tag}
      </span>
      <div>
        <h4
          className="font-serif"
          style={{
            fontSize: '18px',
            fontWeight: 500,
            margin: '0 0 8px',
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--ink-1)',
          }}
          data-testid={`${testIdPrefix}-title`}
        >
          {title}
        </h4>
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="font-serif"
            style={{
              fontSize: '14px',
              lineHeight: 1.75,
              color: 'var(--ink-2)',
              margin: i === paragraphs.length - 1 ? 0 : '0 0 8px',
            }}
            data-testid={`${testIdPrefix}-p-${i}`}
          >
            {renderHighlightedText(p, highlights)}
          </p>
        ))}
        {footer !== undefined ? (
          <div
            className="mt-2"
            data-testid={`${testIdPrefix}-footer`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
