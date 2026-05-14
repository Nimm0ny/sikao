/**
 * SIKAO Wave 4 Phase 2C · CategoryCard — 5 大类卡 (header + 展开 body).
 *
 * hifi 参考: design/SIKAO/handoff/modules/essay-specialty/essay-redesign.html
 * .cat / .cat-header / .cat-body CSS.
 *
 * Header 5 列 grid:
 *   serif 编号 (01-05) / 名称 + desc / 进度条 + 标签 / 数字 + 题数 / 继续按钮 + chevron
 *
 * Body 2 列 sub-grid (SubtypeRow). state='empty' (公文) 退化:
 *   - 无 body 展开
 *   - header CTA 变 ghost "通知我"
 *   - 进度条变 rule-strong (灰)
 *
 * 实施细节:
 *   - useState open 内部管理 (跟 hifi 一致, 默认第一卡 open=true).
 *   - empty 卡 click header 不切换 open (cursor-default).
 *   - "继续上次" vs "去练习" 按钮: 有 continueTarget (resume.typeName 跟此 cat.name
 *     匹配) → "继续上次" + primary; 否则 "去练习" + secondary.
 */
import { useState, useCallback } from 'react';
import type {
  SpecialtyCategoryV2,
  SpecialtySubtypeRowV2,
} from '@sikao/api-client/queries/essaySpecialtyQueries';
import type {
  XingceSpecialtyCategoryV2,
  XingceSpecialtySubtypeRowV2,
} from '@sikao/api-client/queries/xingceSpecialtyQueries';
import { SubtypeRow } from './SubtypeRow';
import type { SpecialtyMode } from './StatStrip';

export type AnyCategory = SpecialtyCategoryV2 | XingceSpecialtyCategoryV2;
type AnyRow = SpecialtySubtypeRowV2 | XingceSpecialtySubtypeRowV2;

export interface CategoryCardProps {
  readonly cat: AnyCategory;
  readonly mode?: SpecialtyMode;
  /** Resume 续答指向的 questionId (跨 cat 共享) — 标记子行 + 切换 header CTA 文案. */
  readonly continueQuestionId?: number | null;
  readonly defaultOpen?: boolean;
  readonly onStartCategory: (cat: AnyCategory) => void;
  readonly onPickSubtype: (questionId: number) => void;
}

interface HeaderCtaProps {
  readonly cat: AnyCategory;
  readonly mode: SpecialtyMode;
  readonly hasContinue: boolean;
  readonly onClick: () => void;
}

function HeaderCta({ cat, mode, hasContinue, onClick }: HeaderCtaProps) {
  if (cat.state === 'empty') {
    // svg-only-allow: specialty empty cat 通知 CTA (非答题 toolbar), 中文 label 必需
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="inline-flex items-center px-3 h-7 text-ink-3 text-xs font-mono tracking-wide uppercase hover:bg-paper-3 rounded-tiny transition-colors duration-fast"
        data-testid={`${mode}-specialty-cat-${cat.id}-notify`}
      >
        通知我 →
      </button>
    );
  }
  const variantClasses = hasContinue
    ? 'bg-ink text-paper border border-ink hover:bg-black'
    : 'bg-paper text-ink border border-ink hover:bg-paper-3';
  const label = hasContinue ? '继续上次' : '去练习';
  return (
    // svg-only-allow: specialty cat 主动作 CTA (非答题 toolbar), 中文 label 必需
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      data-testid={`${mode}-specialty-cat-${cat.id}-cta`}
      className={`inline-flex items-center gap-2 px-4 h-9 text-xs font-mono font-medium tracking-wide uppercase rounded-tiny transition-colors duration-fast ${variantClasses}`}
    >
      {label}
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
  );
}

function findContinueTargetIndex(
  rows: readonly AnyRow[],
  continueQuestionId: number | null | undefined,
): number {
  if (continueQuestionId == null) return -1;
  return rows.findIndex((r) => r.questionId === continueQuestionId);
}

export function CategoryCard({
  cat,
  mode = 'essay',
  continueQuestionId,
  defaultOpen = false,
  onStartCategory,
  onPickSubtype,
}: CategoryCardProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const isEmpty = cat.state === 'empty';
  const continueIdx = findContinueTargetIndex(cat.subTypes, continueQuestionId);
  const hasContinue = continueIdx >= 0;

  const toggle = useCallback((): void => {
    if (!isEmpty) setOpen((v) => !v);
  }, [isEmpty]);

  const onCtaClick = useCallback((): void => {
    onStartCategory(cat);
  }, [cat, onStartCategory]);

  // 进度条比例 0..1, hifi 显示百分数文本 + bar 宽度.
  const pctText =
    isEmpty || cat.total === 0
      ? '—'
      : `${Math.round(cat.overallProgress * 100)}%`;
  const barFill =
    isEmpty || cat.total === 0
      ? 0
      : Math.max(0, Math.min(100, cat.overallProgress * 100));
  const idxLabel = cat.idx.toString().padStart(2, '0');

  return (
    <article
      className={`bg-paper border transition-colors duration-base rounded-card ${
        open ? 'border-ink' : 'border-line hover:border-line-3'
      }`}
      data-testid={`${mode}-specialty-cat-${cat.id}`}
      data-open={open}
      data-empty={isEmpty}
    >
      {/* a11y: header 是 noninteractive sectioning element. accordion expand click
          + Enter/Space keyboard 走 dynamic role/tabIndex (isEmpty 时 no-op). plugin
          不识别 dynamic role, 仍 warn, 行级 escape. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <header
        onClick={toggle}
        onKeyDown={(e) => {
          if (!isEmpty && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggle();
          }
        }}
        role={isEmpty ? undefined : 'button'}
        tabIndex={isEmpty ? undefined : 0}
        aria-expanded={isEmpty ? undefined : open}
        className={`grid grid-cols-[3.5rem_1fr_16rem_9rem_auto] items-center gap-5 px-7 py-5 select-none ${
          isEmpty ? 'cursor-default' : 'cursor-pointer'
        }`}
        data-testid={`${mode}-specialty-cat-${cat.id}-header`}
      >
        <div
          className={`font-serif text-3xl font-medium tracking-tight leading-none tabular-nums transition-colors duration-base ${
            open ? 'text-ink' : 'text-ink-3'
          }`}
        >
          {idxLabel}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-serif text-xl font-semibold tracking-tight text-ink leading-snug truncate">
            {cat.name}
          </span>
          <span className="text-sm text-ink-3 truncate">{cat.desc}</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-[3px] bg-paper-3 overflow-hidden">
            <div
              className={`h-full transition-[width] duration-slow ease-motion ${
                isEmpty ? 'bg-line-3' : 'bg-ink'
              }`}
              style={{ width: `${barFill}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex justify-between font-mono text-tiny tracking-loose uppercase text-ink-3">
            <span>
              {isEmpty
                ? '题库导入中'
                : `${cat.subTypes.length} 子项`}
            </span>
            <span className="text-ink font-semibold">{pctText}</span>
          </div>
        </div>
        <div className="font-mono text-xs text-ink-3 text-right tracking-wide uppercase">
          <span className="block font-serif text-xl font-semibold tracking-tight text-ink lowercase normal-case">
            {isEmpty ? '—' : cat.practiced}
            <span className="ml-1 font-mono text-sm font-medium text-ink-3">
              /{isEmpty ? '—' : cat.total}
            </span>
          </span>
          {isEmpty ? '题库准备中' : '题'}
        </div>
        <div className="justify-self-end inline-flex items-center gap-3">
          <HeaderCta cat={cat} mode={mode} hasContinue={hasContinue} onClick={onCtaClick} />
          {!isEmpty ? (
            <svg
              className={`w-3.5 h-3.5 text-ink-3 transition-transform duration-base ease-motion ${
                open ? 'rotate-180 text-ink' : ''
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          ) : null}
        </div>
      </header>
      {open && !isEmpty ? (
        <div
          className="border-t border-line bg-paper-3 px-7 py-5"
          data-testid={`${mode}-specialty-cat-${cat.id}-body`}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-mono text-tiny tracking-widest uppercase text-ink-3 font-medium">
              ↓ 按题型 · 选一子项专攻
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {cat.subTypes.map((row, idx) => (
              <SubtypeRow
                key={row.id}
                row={row}
                mode={mode}
                isContinueTarget={idx === continueIdx}
                onClick={onPickSubtype}
              />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
