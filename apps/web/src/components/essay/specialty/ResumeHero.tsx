/**
 * SIKAO Wave 4 Phase 2C · ResumeHero — 续答 hero band.
 *
 * hifi 参考: design/SIKAO/handoff/modules/essay-specialty/essay-redesign.html
 * .resume CSS (墨黑底 + 右侧暗朱径向渐变 + 54×54 印章 + kicker + meta + 双按钮).
 *
 * 渲染规则:
 *   - resume === null → 调用方不渲染 (用户无 grading record).
 *   - resume.weekGoal = [done, total] (后端 [done, 7], total 默认硬 7).
 *   - lastScores 最近 5 条, 显前 3 条 (空 → "—").
 *
 * 暗朱径向渐变走 `bg-exam-accent` token (已在 §3.7 inventory, paper-tint family),
 * 不新增 token (lhr 任务范围明确禁 token 改).
 */
import { useMemo } from 'react';
import type { SpecialtyResumeV2 } from '@sikao/api-client/queries/essaySpecialtyQueries';
import type { XingceSpecialtyResumeV2 } from '@sikao/api-client/queries/xingceSpecialtyQueries';
import type { SpecialtyMode } from './StatStrip';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

export interface ResumeHeroProps {
  readonly resume: SpecialtyResumeV2 | XingceSpecialtyResumeV2;
  readonly mode?: SpecialtyMode;
  readonly onContinue: (questionId: number) => void;
  readonly onDefer?: () => void;
}

interface MetaParts {
  readonly recentScoresText: string;
  readonly hasScores: boolean;
}

function buildMeta(
  resume: SpecialtyResumeV2 | XingceSpecialtyResumeV2,
): MetaParts {
  // lastScores BE 已是从新到旧, 取前 3, 写为 "34 · 41 · 38".
  const top3 = resume.lastScores.slice(0, 3);
  if (top3.length === 0) {
    return { recentScoresText: '—', hasScores: false };
  }
  const text = top3
    .map((s) => (Number.isInteger(s) ? String(s) : s.toFixed(1)))
    .join(' · ');
  return { recentScoresText: text, hasScores: true };
}

export function ResumeHero({
  resume,
  mode = 'essay',
  onContinue,
  onDefer,
}: ResumeHeroProps) {
  const meta = useMemo(() => buildMeta(resume), [resume]);
  const [weekDone, weekTotal] = resume.weekGoal;
  const handleContinue = (): void => {
    onContinue(resume.questionId);
  };

  return (
    <section
      className="relative overflow-hidden grid grid-cols-[auto_1fr_auto] items-center gap-6 px-7 py-5 bg-ink text-paper rounded-card"
      data-testid={`${mode}-specialty-resume-hero`}
      aria-label="续答上次"
    >
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 bottom-0 w-72 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at right, var(--exam-accent), transparent 70%)',
        }}
      />
      <div
        className="relative z-10 w-14 h-14 grid place-items-center font-serif text-2xl font-medium tracking-tight border border-paper/25 text-paper rounded-card"
        aria-hidden="true"
      >
        <span>续</span>
      </div>
      <div className="relative z-10 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-pill bg-exam-accent"
            data-pattern="dot"
          />
          <span className="font-mono text-tiny tracking-widest uppercase text-paper/55">
            {ESSAY_SIKAO_COPY.resumeHere}
          </span>
        </div>
        <h2 className="font-serif text-xl font-medium tracking-tight leading-snug">
          {resume.typeName}
          <span className="ml-2 text-paper/55 font-normal">
            / 第 {resume.qIndex} · {resume.qTotal} 题
          </span>
        </h2>
        <div className="mt-2 flex items-center gap-4 font-mono text-tiny text-paper/55 tracking-loose">
          {meta.hasScores ? (
            <span data-testid={`${mode}-specialty-resume-recent`}>
              近三次 <strong className="text-paper font-semibold">{meta.recentScoresText}</strong>
            </span>
          ) : (
            <span data-testid={`${mode}-specialty-resume-recent`}>
              近三次 <strong className="text-paper font-semibold">—</strong>
            </span>
          )}
          <span aria-hidden="true" className="w-px h-2.5 bg-paper/20" />
          <span>
            本周目标{' '}
            <strong className="text-paper font-semibold">
              {weekDone}/{weekTotal}
            </strong>{' '}
            题
          </span>
        </div>
      </div>
      <div className="relative z-10 flex gap-2 items-center">
        {onDefer !== undefined ? (
          // svg-only-allow: main-cta — specialty hero secondary CTA 是 view 入口 (非答题 toolbar)
          <button
            type="button"
            onClick={onDefer}
            data-testid={`${mode}-specialty-resume-defer`}
            aria-label="留到下次"
            className="inline-flex items-center gap-2 px-4 h-9 border border-paper/35 text-paper text-xs font-mono tracking-wide uppercase rounded-tiny hover:bg-paper/10 transition-colors duration-fast"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="6" cy="6" r="4.5" />
              <path d="M6 3.5v2.5l1.5 1" />
            </svg>
            留到下次
          </button>
        ) : null}
        {/* svg-only-allow: main-cta — specialty hero primary CTA 是 view 入口 + 主动作 (非答题 toolbar) */}
        <button
          type="button"
          onClick={handleContinue}
          data-testid={`${mode}-specialty-resume-continue`}
          aria-label="继续作答"
          className="inline-flex items-center gap-2 px-4 h-9 bg-paper text-ink text-xs font-mono font-semibold tracking-wide uppercase rounded-tiny hover:bg-paper-3 transition-colors duration-fast"
        >
          继续作答
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m4 3 5 3-5 3" />
          </svg>
        </button>
      </div>
    </section>
  );
}
