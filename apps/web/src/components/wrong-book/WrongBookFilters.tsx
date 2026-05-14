import { memo } from 'react';
import { Badge, Card, PipeNav } from '@sikao/ui/ui';
import type { MasteryLevel } from '@sikao/api-client/types/api';
import type { WrongQuestionFilters } from '@sikao/api-client/apiQueries';

// Phase 5.4e — 左栏筛选。三档掌握度（danger/warn/success）+ subject chips
// (PipeNav) + 总览数字。dumb：value + availableSubjects + onChange 全从 smart
// container 传进来。
//
// memo 化 (T-C3 P2 follow-up review): props 全 stable refs (value / onChange
// useCallback / availableSubjects / availableSubtypes 走 React Query data
// stable ref / total primitive), parent WrongBook children render prop 每次
// 重建但 props 引用不变 → memo 跳过 re-render.

const MASTERY_OPTIONS: readonly {
  readonly value: MasteryLevel | 'all';
  readonly label: string;
  readonly tone: 'danger' | 'warn' | 'success' | 'neutral';
}[] = [
  { value: 'all', label: '全部', tone: 'neutral' },
  { value: 'not_mastered', label: '未掌握', tone: 'danger' },
  { value: 'reviewing', label: '复习中', tone: 'warn' },
  { value: 'mastered', label: '已掌握', tone: 'success' },
];

export interface WrongBookFiltersProps {
  readonly value: WrongQuestionFilters;
  readonly onChange: (next: WrongQuestionFilters) => void;
  readonly availableSubjects: readonly string[];
  // ARCH §7.3 P3 followup: subtype chip 二级筛选, 后端 Phase 6.4 P2 已支持.
  // 服务端按 subject+mastery 过滤 (不含 subtype) 算 facets, 让 chip 不折叠.
  readonly availableSubtypes: readonly string[];
  readonly total: number;
}

function WrongBookFiltersImpl({
  value,
  onChange,
  availableSubjects,
  availableSubtypes,
  total,
}: WrongBookFiltersProps) {
  const masteryValue: MasteryLevel | 'all' = value.masteryLevel ?? 'all';
  const subjectValue: string = value.subject ?? 'all';
  const subtypeValue: string = value.subtype ?? 'all';

  return (
    <aside className="space-y-5" data-testid="wrong-book-filters">
      {/* 总览 */}
      <Card padding="sm">
        <div className="text-tiny font-mono font-semibold tracking-widest uppercase text-ink-4">
          错题总量
        </div>
        <div className="mt-1 font-serif italic text-4xl tabular-nums text-ink">
          {total}
        </div>
      </Card>

      {/* 掌握度筛选 */}
      <div>
        <div className="text-tiny font-semibold text-ink-3 mb-2 tracking-normal">掌握度</div>
        <div className="flex flex-col gap-1">
          {MASTERY_OPTIONS.map((opt) => {
            const active = masteryValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    page: 1,
                    masteryLevel: opt.value === 'all' ? undefined : opt.value,
                  })
                }
                className={
                  'flex items-center justify-between text-sm px-3 py-2 rounded-tiny border transition-colors duration-fast ' +
                  (active
                    ? 'border-ink bg-surface-alt text-ink font-semibold'
                    : 'border-transparent text-ink-3 hover:text-ink hover:bg-surface-alt')
                }
                aria-pressed={active}
              >
                <span>{opt.label}</span>
                {opt.tone !== 'neutral' ? (
                  <Badge variant="chip" tone={opt.tone} dot>
                    {opt.tone === 'danger' ? '!' : opt.tone === 'warn' ? '~' : '✓'}
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* 科目筛选 */}
      {availableSubjects.length > 0 ? (
        <div>
          <div className="text-tiny font-semibold text-ink-3 mb-2 tracking-normal">科目</div>
          <PipeNav
            items={[
              { value: 'all', label: '全部' },
              ...availableSubjects.map((s) => ({ value: s, label: s })),
            ]}
            value={subjectValue}
            onChange={(next) =>
              onChange({
                ...value,
                page: 1,
                // 切换 subject 必须清掉 subtype, 否则旧 subject 的 subtype
                // 在新 subject 下 0 命中 → 列表空, UX 困惑.
                subject: next === 'all' ? undefined : next,
                subtype: undefined,
              })
            }
            className="flex-col items-start gap-2 !gap-y-2"
          />
        </div>
      ) : null}

      {/* subtype 二级筛选 — Phase 6.4 P2 后端已支持, B.2 前端补 chip selector.
          只在 availableSubtypes 非空 (有错题) 且非"全部 subjects" 选中时显示
          (subjects=all 时 subtype 跨科目意义不强, 隐藏减少视觉噪声). */}
      {subjectValue !== 'all' && availableSubtypes.length > 0 ? (
        <div>
          <div className="text-tiny font-semibold text-ink-3 mb-2 tracking-normal">题型</div>
          <div className="flex flex-wrap gap-2" data-testid="wrong-book-subtype-chips">
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, page: 1, subtype: undefined })
              }
              className={
                'text-xs px-3 py-1 rounded-tiny border transition-colors duration-fast ' +
                (subtypeValue === 'all'
                  ? 'border-ink bg-ink text-surface font-semibold'
                  : 'border-line text-ink-3 hover:text-ink hover:border-ink')
              }
              aria-pressed={subtypeValue === 'all'}
              data-testid="wrong-book-subtype-all"
            >
              全部
            </button>
            {availableSubtypes.map((st) => {
              const active = subtypeValue === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() =>
                    onChange({ ...value, page: 1, subtype: active ? undefined : st })
                  }
                  className={
                    'text-xs px-3 py-1 rounded-tiny border transition-colors duration-fast ' +
                    (active
                      ? 'border-ink bg-ink text-surface font-semibold'
                      : 'border-line text-ink-3 hover:text-ink hover:border-ink')
                  }
                  aria-pressed={active}
                  data-testid={`wrong-book-subtype-${st}`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export const WrongBookFilters = memo(WrongBookFiltersImpl);
