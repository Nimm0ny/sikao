/**
 * SIKAO Wave 4 Phase 2C · PaperRow — EssayPapers list 单行.
 *
 * hifi 参考: design/SIKAO/handoff/modules/essay-specialty/essay-redesign.html
 * .paper-row CSS (5 列 grid: yr-block / p-title + tags / p-stat / p-status / row-cta).
 *
 * 状态 pill 三态:
 *   - todo:  dashed border, ink-3 文字, "未做"
 *   - doing: warn bg + warn 文字, "进行中 N/M"
 *   - done:  ok bg + ok 文字, "已做"
 *
 * pinned: 左边 3px 暗朱条 (var(--exam-accent)).
 * track gk 国考 → badge 实心 ink, sk 省考 → badge 描边.
 *
 * CTA 按钮文案随 status: todo="开始" / doing="继续" / done="再练".
 */
import { useMemo } from 'react';
import type {
  EssayPaperListItemV2Extended,
} from '@sikao/api-client/queries/essaySpecialtyQueries';
import type {
  XingcePaperListItemV2Extended,
} from '@sikao/api-client/queries/xingceSpecialtyQueries';
import type { SpecialtyMode } from '../specialty/StatStrip';

export type AnyPaperRow =
  | EssayPaperListItemV2Extended
  | XingcePaperListItemV2Extended;

export interface PaperRowProps {
  readonly paper: AnyPaperRow;
  readonly mode?: SpecialtyMode;
  readonly onClick: (paper: AnyPaperRow) => void;
}

interface CtaLabel {
  readonly label: string;
}

function getCtaLabel(status: AnyPaperRow['status']): CtaLabel {
  if (status === 'doing') return { label: '继续' };
  if (status === 'done') return { label: '再练' };
  return { label: '开始' };
}

interface StatusPillProps {
  readonly status: AnyPaperRow['status'];
  readonly progress: string;
  readonly mode: SpecialtyMode;
}

function StatusPill({ status, progress, mode }: StatusPillProps) {
  if (status === 'doing') {
    return (
      <span
        className="inline-flex items-center gap-2 h-6 px-3 bg-warn-bg text-warn font-mono text-tiny font-semibold uppercase tracking-wider rounded-tiny"
        data-testid={`${mode}-paper-row-status-doing`}
      >
        进行中 <span className="font-mono">{progress}</span>
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span
        className="inline-flex items-center gap-2 h-6 px-3 bg-ok-bg text-ok font-mono text-tiny font-semibold uppercase tracking-wider rounded-tiny"
        data-testid={`${mode}-paper-row-status-done`}
      >
        已做
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center h-6 px-3 border border-dashed border-line-3 text-ink-3 font-mono text-tiny font-semibold uppercase tracking-wider rounded-tiny"
      data-testid={`${mode}-paper-row-status-todo`}
    >
      未做
    </span>
  );
}

interface DifficultyDotsProps {
  readonly level: 1 | 2 | 3 | null | undefined;
  readonly mode: SpecialtyMode;
}

function DifficultyDots({ level, mode }: DifficultyDotsProps) {
  const lit = level ?? 0;
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`难度 ${lit}/3`}
      data-testid={`${mode}-paper-row-difficulty`}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-pill ${i <= lit ? 'bg-ink' : 'bg-line-3'}`}
          data-pattern="dot"
        />
      ))}
    </span>
  );
}

function formatLastAttempt(at: string): string {
  // ISO datetime → "YYYY-MM-DD" 简写 (避 Date 解析跨 tz 误差, 直接截前 10 char).
  const dateStr = at.slice(0, 10);
  return dateStr;
}

export function PaperRow({ paper, mode = 'essay', onClick }: PaperRowProps) {
  const cta = useMemo(() => getCtaLabel(paper.status), [paper.status]);
  const handleClick = (): void => {
    onClick(paper);
  };
  const yearLabel = paper.examYear ?? '—';
  const isGuokao = paper.region === '国考';

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      data-testid={`${mode}-paper-row-${paper.paperCode}`}
      data-status={paper.status}
      className="group relative grid grid-cols-[5.5rem_1fr_9rem_9rem_7.5rem] items-center gap-5 px-7 py-5 border-b border-line last:border-b-0 cursor-pointer hover:bg-paper-3 transition-colors duration-fast"
    >
      {paper.pinned ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-exam-accent"
          data-pattern="dot"
        />
      ) : null}
      <div className="flex flex-col items-start gap-1">
        <span className="font-serif text-3xl font-semibold tracking-tight text-ink leading-none tabular-nums">
          {yearLabel}
        </span>
        <span
          className={`font-mono text-tiny tracking-widest uppercase px-2 py-1 ${
            isGuokao
              ? 'bg-ink text-paper border border-ink'
              : 'text-ink-3 border border-line-3'
          }`}
        >
          {isGuokao ? '国考' : '省考'}
        </span>
      </div>
      <div className="min-w-0">
        <h4 className="font-serif text-base font-semibold text-ink tracking-tight leading-snug mb-2 truncate">
          {paper.paperName}
        </h4>
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-tiny tracking-wider uppercase px-2 py-1 text-ink font-semibold bg-paper-3 border border-line-3">
            {paper.region}
          </span>
          {paper.sourceKind !== null && paper.sourceKind !== undefined ? (
            <span className="font-mono text-tiny tracking-wider uppercase px-2 py-1 text-ink-3 border border-line">
              {paper.sourceKind}
            </span>
          ) : null}
        </div>
      </div>
      <div className="font-mono text-tiny text-ink-3 tracking-wider uppercase tabular-nums flex flex-col gap-2">
        <span className="flex items-baseline gap-2">
          <span className="font-serif text-lg font-semibold text-ink tracking-tight normal-case">
            {paper.questionCount}
          </span>
          题
        </span>
        <DifficultyDots level={paper.difficulty} mode={mode} />
      </div>
      <div className="font-mono text-tiny text-ink-3 tracking-wide uppercase">
        {paper.lastAttempt !== null && paper.lastAttempt !== undefined ? (
          <span data-testid={`${mode}-paper-row-${paper.paperCode}-last`}>
            上次{' '}
            <strong className="font-serif text-sm font-semibold text-ink-3 tracking-tight normal-case">
              {formatLastAttempt(paper.lastAttempt.submittedAt)}
            </strong>
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        )}
        <div className="mt-2">
          <StatusPill status={paper.status} progress={paper.progress} mode={mode} />
        </div>
      </div>
      <div className="justify-self-end">
        {/* svg-only-allow: paper row 主动作 CTA (非答题 toolbar), 中文 label */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="inline-flex items-center gap-2 px-4 h-9 text-xs font-mono font-medium tracking-wide uppercase rounded-tiny border border-line-3 text-ink-3 bg-transparent group-hover:bg-ink group-hover:text-paper group-hover:border-ink transition-colors duration-fast"
          data-testid={`${mode}-paper-row-${paper.paperCode}-cta`}
        >
          {cta.label}
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
    </div>
  );
}
