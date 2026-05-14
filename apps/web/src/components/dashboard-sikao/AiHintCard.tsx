import type { ReactNode } from 'react';

/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.ai-1920` AI 今日提示 落地.
 *
 * Dumb 卡: title + version chip + serif body + 引导 quote + 2 操作.
 *
 * 数据现状: BE 暂无 `/dashboard/ai-hint` endpoint. 当前由 caller 传 mock 文案
 * (静态文 + TODO 标 dashboard.tsx). 后续接入 LLM 时本组件 props 不变.
 * TODO(2026-05-11 lhr): connect to BE LLM endpoint when available.
 */

export interface AiHintCardProps {
  /** 题面解读 / 启发. 允许 ReactNode 让 caller 嵌 <strong>. */
  readonly body: ReactNode;
  /** 引导文 (quote block, serif italic 在 ASCII allow / CJK forbid; caller 写中文不 italic). */
  readonly quote: string;
  /** 跳转 "看思路图" 回调. */
  readonly onShowThinking?: () => void;
  /** 跳转 "问 AI" 回调. */
  readonly onAskAi?: () => void;
  /** 版本标 (e.g. "v3 · 思考"). */
  readonly versionLabel?: string;
}

export function AiHintCard({
  body,
  quote,
  onShowThinking,
  onAskAi,
  versionLabel = 'v3 · 思考',
}: AiHintCardProps) {
  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4 shadow-card"
      data-testid="dashboard-ai-hint"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-lg font-medium m-0">AI · 今日提示</h4>
        <span
          className="font-mono text-tiny tracking-widest uppercase px-2 py-1 border border-accent text-accent"
          style={{ borderRadius: 'var(--r-1)' }}
        >
          {versionLabel}
        </span>
      </header>

      <div className="font-serif text-base leading-relaxed text-ink-3">
        {body}
      </div>

      <blockquote
        className="border-l-2 border-accent pl-4 py-1 text-ink text-sm leading-relaxed m-0"
        // 中文 quote: serif 不带 italic (CJK 禁 italic 政策).
      >
        {quote}
      </blockquote>

      <div className="flex flex-wrap gap-2 mt-1">
        {onShowThinking != null ? (
          <button
            type="button"
            onClick={onShowThinking}
            className="rounded-tiny bg-surface text-ink border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-white transition-colors duration-fast"
            data-testid="dashboard-ai-hint-thinking"
          >
            看思路图
          </button>
        ) : null}
        {onAskAi != null ? (
          <button
            type="button"
            onClick={onAskAi}
            className="text-accent text-sm font-medium hover:underline underline-offset-4"
            data-testid="dashboard-ai-hint-ask"
          >
            问 AI →
          </button>
        ) : null}
      </div>
    </section>
  );
}
