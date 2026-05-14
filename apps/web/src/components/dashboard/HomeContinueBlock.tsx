/**
 * SIKAO Wave 8 Phase C · Home block 1 — 继续学习.
 *
 * 数据源: useContinueLastSession() → PracticeSessionSummary | null.
 * 显示: paper title + progress (answered / total) + "继续 →" CTA.
 * Empty 态: "暂无未完成的练习" + "开始新的 →" CTA → /papers.
 *
 * Dumb by contract (frontend/CLAUDE.md §2.2): 不 fetch / 不写 store; props 接
 * 数据 + onContinue / onStart callback. caller (Dashboard.tsx) 处理路由.
 *
 * 调性: SIKAO ink-first paper. rounded-card token. SVG icon-only by §4 italic
 * 政策 (CJK 禁 italic, 数字大字走 font-serif). 标题走 font-serif text-h-card.
 */

import type { PracticeSessionSummary } from '@sikao/domain/dashboard/useHomeData';

export interface HomeContinueBlockProps {
  /** 上次中断 session, null 表示无未完成 session. */
  readonly lastSession: PracticeSessionSummary | null;
  /** 继续点击回调; lastSession 非 null 时 caller 跳 /practice/sessions/{id}. */
  readonly onContinue: (session: PracticeSessionSummary) => void;
  /** 开始新练习; empty 态 caller 跳 /papers. */
  readonly onStartNew: () => void;
}

export function HomeContinueBlock({
  lastSession,
  onContinue,
  onStartNew,
}: HomeContinueBlockProps) {
  // Empty 态: 暂无 unfinished session, 引导跳 /papers
  if (lastSession == null) {
    return (
      <section
        className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
        data-testid="home-continue-block"
      >
        <header className="flex items-baseline justify-between pb-3 border-b border-line">
          <h4 className="font-serif text-h-card font-medium m-0">继续学习</h4>
          <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
            01 / 04
          </span>
        </header>
        <p className="text-sm text-ink-3 leading-relaxed flex-1">
          暂无未完成的练习。挑一套今天先做。
        </p>
        <button
          type="button"
          onClick={onStartNew}
          className="self-start rounded-tiny bg-surface text-ink border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-white transition-colors duration-fast"
          data-testid="home-continue-start-new"
        >
          开始新的 →
        </button>
      </section>
    );
  }

  // Happy 态: 有未完成 session
  const progressPct = Math.min(
    100,
    Math.round((lastSession.answeredCount / Math.max(1, lastSession.total)) * 100),
  );

  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
      data-testid="home-continue-block"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-h-card font-medium m-0">继续学习</h4>
        <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          01 / 04
        </span>
      </header>
      <div className="flex-1 flex flex-col gap-2">
        <p
          className="font-serif text-base text-ink m-0 truncate"
          title={lastSession.paperTitle}
          data-testid="home-continue-paper-title"
        >
          {lastSession.paperTitle}
        </p>
        <p className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          进度 · {lastSession.answeredCount} / {lastSession.total} ·{' '}
          {progressPct}%
        </p>
        <div
          className="relative h-1.5 bg-paper-3 overflow-hidden"
          style={{ borderRadius: 'var(--r-1)' }}
          aria-hidden="true"
        >
          <i
            className="absolute inset-y-0 left-0 block bg-ink"
            style={{ width: `${Math.max(2, progressPct)}%` }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onContinue(lastSession)}
        className="self-start rounded-tiny bg-ink text-paper px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity duration-fast"
        data-testid="home-continue-resume"
      >
        继续 →
      </button>
    </section>
  );
}
