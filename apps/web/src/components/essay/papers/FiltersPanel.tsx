/**
 * SIKAO Wave 4 Phase 2C · FiltersPanel — EssayPapers 筛选面板.
 *
 * hifi 参考: design/SIKAO/handoff/modules/essay-specialty/essay-redesign.html
 * .filters / .f-row / .fchip / .filters-foot CSS.
 *
 * 3 行 grid (key: 96px | chips: 1fr):
 *   - 地区: regions chip 集 (BE 返 distinct source_provider + 国考/省考 派生)
 *   - 卷型: paperTypes chip 集 (source_kind)
 *   - 年份: years chip 集 (DESC)
 *
 * footer:
 *   - sum-tags 显示已选条件 (region / year / paperType)
 *   - "重置筛选" 文字 link (mono uppercase + 下划线)
 *
 * filter chip 设计:
 *   - 全部 = "" (空字符串当 sentinel, 不发请求时省略)
 *   - active: bg-ink text-paper
 *   - default: 透明背景 + ink-2 文字, hover paper-deep
 */
import { useMemo } from 'react';
import type { EssayPapersFiltersResponseV2 } from '@sikao/api-client/queries/essaySpecialtyQueries';
import type { XingcePapersFiltersResponseV2 } from '@sikao/api-client/queries/xingceSpecialtyQueries';
import type { SpecialtyMode } from '../specialty/StatStrip';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

export type FilterField = 'region' | 'year' | 'paperType';

export interface FiltersValue {
  readonly region: string;
  readonly year: number | null;
  readonly paperType: string;
}

export interface FiltersPanelProps {
  readonly filters:
    | EssayPapersFiltersResponseV2
    | XingcePapersFiltersResponseV2;
  readonly value: FiltersValue;
  readonly totalCount: number;
  readonly mode?: SpecialtyMode;
  readonly onChange: (next: FiltersValue) => void;
  readonly onReset: () => void;
}

interface FChipProps {
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly testId: string;
}

function FChip({ active, label, onClick, testId }: FChipProps) {
  const stateClasses = active
    ? 'bg-ink text-paper'
    : 'bg-transparent text-ink-3 hover:bg-paper-3 hover:text-ink';
  return (
    // svg-only-allow: filter chip 是 content navigation (非答题 toolbar), 中文 label
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-active={active}
      className={`inline-flex items-center h-7 px-4 text-sm font-medium border border-transparent rounded-tiny transition-colors duration-fast tabular-nums ${stateClasses}`}
    >
      {label}
    </button>
  );
}

interface RowProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

function FilterRow({ label, children }: RowProps) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-start gap-4 px-6 py-3 border-b border-line last:border-b-0">
      <span className="pt-2 font-mono text-tiny tracking-widest uppercase text-ink-3">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function buildSumTags(
  value: FiltersValue,
): readonly { readonly key: FilterField; readonly text: string }[] {
  const tags: { readonly key: FilterField; readonly text: string }[] = [];
  if (value.region !== '') {
    tags.push({ key: 'region', text: `地区: ${value.region}` });
  }
  if (value.year !== null) {
    tags.push({ key: 'year', text: `${value.year} 年` });
  }
  if (value.paperType !== '') {
    tags.push({ key: 'paperType', text: `${value.paperType}` });
  }
  return tags;
}

export function FiltersPanel({
  filters,
  value,
  totalCount,
  mode = 'essay',
  onChange,
  onReset,
}: FiltersPanelProps) {
  const ariaLabel = mode === 'xingce' ? ESSAY_SIKAO_COPY.filtersXingce : ESSAY_SIKAO_COPY.filtersEssay;
  const tid = (k: string): string => `${mode}-papers-${k}`;
  const sumTags = useMemo(() => buildSumTags(value), [value]);
  const hasFilters = sumTags.length > 0;

  const handleRegion = (next: string): void => {
    onChange({ ...value, region: next });
  };
  const handleYear = (next: number | null): void => {
    onChange({ ...value, year: next });
  };
  const handlePaperType = (next: string): void => {
    onChange({ ...value, paperType: next });
  };
  const handleClearTag = (key: FilterField): void => {
    if (key === 'region') onChange({ ...value, region: '' });
    if (key === 'year') onChange({ ...value, year: null });
    if (key === 'paperType') onChange({ ...value, paperType: '' });
  };

  return (
    <section
      className="bg-paper border border-line rounded-card overflow-hidden"
      data-testid={tid('filters')}
      aria-label={ariaLabel}
    >
      <FilterRow label="地区">
        <FChip
          active={value.region === ''}
          label="全部"
          onClick={() => handleRegion('')}
          testId={tid('filter-region-all')}
        />
        {filters.regions.map((r) => (
          <FChip
            key={r}
            active={value.region === r}
            label={r}
            onClick={() => handleRegion(r)}
            testId={tid(`filter-region-${r}`)}
          />
        ))}
      </FilterRow>
      <FilterRow label="卷型">
        <FChip
          active={value.paperType === ''}
          label="全部卷型"
          onClick={() => handlePaperType('')}
          testId={tid('filter-paperType-all')}
        />
        {filters.paperTypes.map((p) => (
          <FChip
            key={p}
            active={value.paperType === p}
            label={p}
            onClick={() => handlePaperType(p)}
            testId={tid(`filter-paperType-${p}`)}
          />
        ))}
      </FilterRow>
      <FilterRow label="年份">
        <FChip
          active={value.year === null}
          label="近 5 年"
          onClick={() => handleYear(null)}
          testId={tid('filter-year-all')}
        />
        {filters.years.map((y) => (
          <FChip
            key={y}
            active={value.year === y}
            label={String(y)}
            onClick={() => handleYear(y)}
            testId={tid(`filter-year-${y}`)}
          />
        ))}
      </FilterRow>
      <div className="flex items-center justify-between gap-3 px-6 py-3 bg-paper-3 border-t border-line">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
          {sumTags.map((tag) => (
            <span
              key={tag.key}
              className="inline-flex items-center gap-2 h-6 px-3 bg-paper border border-line font-mono text-tiny tracking-loose uppercase text-ink-3"
              data-testid={tid(`filter-tag-${tag.key}`)}
            >
              {tag.text}
              {/* svg-only-allow: filter tag clear (×) 走 ASCII editorial 符号, 非答题 */}
              <button
                type="button"
                onClick={() => handleClearTag(tag.key)}
                aria-label={`移除 ${tag.text}`}
                className="text-ink-3 hover:text-ink leading-none text-base"
              >
                ×
              </button>
            </span>
          ))}
          <span className="font-mono text-tiny tracking-wide uppercase text-ink-3">
            匹配{' '}
            <strong className="font-serif text-base font-semibold text-ink tracking-tight normal-case mx-1">
              {totalCount}
            </strong>{' '}
            套
          </span>
        </div>
        {hasFilters ? (
          // svg-only-allow: main-cta — reset 文字 link (非答题 toolbar), 中文 label
          <button
            type="button"
            onClick={onReset}
            data-testid={tid('filter-reset')}
            aria-label="重置筛选"
            className="inline-flex items-center gap-1 font-mono text-tiny tracking-wide uppercase text-ink-3 hover:text-ink underline decoration-line-strong underline-offset-2"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M2 6a4 4 0 1 0 1.5-3.1" />
              <path d="M2 1.5V4h2.5" />
            </svg>
            重置筛选
          </button>
        ) : null}
      </div>
    </section>
  );
}
