import { ChevronRightIcon } from '@sikao/ui/icons';
import { Card } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { CategorySummaryV2 } from '@sikao/api-client/types/api';

// CategoryChipRow — 学习中心首页 §4 专项练习入口的紧凑版.
// 6 大类 (CategoriesResponseV2) 一行显示, total=0 禁用. 跟 /categories 完整网格
// 互补: 这里是"快速进入", 详细进度+大块行动去 /categories.

interface CategoryChipRowProps {
  readonly categories: readonly CategorySummaryV2[];
  readonly onPick: (topType: string) => void;
  readonly onSeeAll: () => void;
}

export function CategoryChipRow({ categories, onPick, onSeeAll }: CategoryChipRowProps) {
  if (categories.length === 0) return null;
  return (
    <Card padding="md" data-testid="home-category-chip-row">
      <header className="flex items-end justify-between mb-3 gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">专项练习</h2>
          <p className="text-xs text-ink-3 mt-1">
            选一个模块, 按你节奏练. 进度跟着你的实际作答更新.
          </p>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-sm text-ink-3 hover:text-ink transition-colors shrink-0"
          data-testid="home-categories-see-all"
        >
          查看全部 →
        </button>
      </header>
      <div className="flex flex-wrap gap-2" data-testid="home-category-chips">
        {categories.map((cat) => (
          <CategoryChip key={cat.topType} category={cat} onPick={onPick} />
        ))}
      </div>
    </Card>
  );
}

interface CategoryChipProps {
  readonly category: CategorySummaryV2;
  readonly onPick: (topType: string) => void;
}

function CategoryChip({ category, onPick }: CategoryChipProps) {
  const isEmpty = category.total === 0;
  const percent = isEmpty ? null : Math.round((category.doneByUser / category.total) * 100);

  return (
    <button
      type="button"
      disabled={isEmpty}
      onClick={() => onPick(category.topType)}
      data-testid={`home-category-chip-${category.topType}`}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-tiny border transition-colors',
        'text-sm font-medium',
        isEmpty
          ? 'border-line bg-surface-alt text-ink-4 cursor-not-allowed'
          : 'border-line bg-surface text-ink hover:border-ink hover:bg-surface-alt',
      )}
    >
      <span>{category.name}</span>
      {percent !== null ? (
        <span className="font-mono text-tiny text-ink-3 tabular-nums">{percent}%</span>
      ) : (
        <span className="text-tiny text-ink-4">准备中</span>
      )}
      {!isEmpty ? (
        <ChevronRightIcon className="w-3.5 h-3.5 text-ink-4" aria-hidden="true" />
      ) : null}
    </button>
  );
}
