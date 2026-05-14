import { useMemo } from 'react';

// Pagination — Sunday polish 抽 atom (2026-05-08, Sunday Sprint).
//
// 来源: 收口 EssayPapers / EssaySpecialty / Papers 三处 inline buildPageList
// + PageButton 实现 (2026-05-04 ~ 2026-05-08 三个 batch 各自 inline 复制).
// 第 4 处 (backend xingce/list endpoint 出来后 Papers 继续用) 出现就该抽 — 现在 3 处
// 已经 SSOT 撕裂风险, 抽到 atom.
//
// Visual 决定 (subagent reviewer P2 反馈): rounded-tiny (10px) + h-8 + text-xs
// font-mono 统一. EssayPapers / EssaySpecialty 之前 inline rounded-card (12px)
// 在 32px button 上 37.5% 占比偏肉, 不符合 ink-first 工具感 — atom 收口顺手
// 统一为 rounded-tiny (跟 Button atom 同 token), 三处一致.
//
// API:
//   <Pagination
//     page={1}
//     totalPages={13}
//     onChange={(next) => setPage(next)}
//     testIdPrefix="essay-papers"  // → data-testid="essay-papers-pager-{prev|N|next}"
//     ariaLabel="申论真题分页"      // optional, 默认 '分页'
//   />
//
// testIdPrefix mandatory: 多 view 同时 mount 时 (e.g. modal 内嵌) 强制 caller
// 命名独立 namespace, 防 testid 撞车. ariaLabel 可选 (兜底默认 '分页').
//
// buildPageList 折叠规则: total ≤ 7 全显; > 7 显 1 + 当前 ± 1 + total, 中间塞 '…'.

export interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onChange: (next: number) => void;
  readonly testIdPrefix: string;
  readonly ariaLabel?: string;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  testIdPrefix,
  ariaLabel = '分页',
}: PaginationProps) {
  const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 pt-2"
      aria-label={ariaLabel}
      data-testid={`${testIdPrefix}-pager`}
    >
      <PageButton
        disabled={prevDisabled}
        onClick={() => onChange(page - 1)}
        testId={`${testIdPrefix}-pager-prev`}
        ariaLabel="上一页"
      >
        ←
      </PageButton>
      {pages.map((p, idx) =>
        p === '…' ? (
          <span
            key={`gap-${idx}`}
            aria-hidden="true"
            className="font-mono text-xs text-ink-4 px-1"
          >
            …
          </span>
        ) : (
          <PageButton
            key={p}
            active={p === page}
            onClick={() => onChange(p)}
            testId={`${testIdPrefix}-pager-${p}`}
            ariaLabel={`第 ${p} 页`}
            ariaCurrent={p === page ? 'page' : undefined}
          >
            {p}
          </PageButton>
        ),
      )}
      <PageButton
        disabled={nextDisabled}
        onClick={() => onChange(page + 1)}
        testId={`${testIdPrefix}-pager-next`}
        ariaLabel="下一页"
      >
        →
      </PageButton>
    </nav>
  );
}

interface PageButtonProps {
  readonly children: React.ReactNode;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly testId: string;
  readonly ariaLabel: string;
  readonly ariaCurrent?: 'page' | undefined;
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
  testId,
  ariaLabel,
  ariaCurrent,
}: PageButtonProps) {
  const base = 'min-w-[32px] h-8 px-3 rounded-tiny font-mono text-xs transition-colors';
  const variant = active
    ? 'font-semibold bg-ink text-white border border-ink'
    : disabled
      ? 'text-ink-4 border border-line bg-surface cursor-not-allowed'
      : 'text-ink-3 border border-line bg-surface hover:border-line-3';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      className={`${base} ${variant}`}
    >
      {children}
    </button>
  );
}

// total ≤ 7 全显, > 7 显 1 + (current-1, current, current+1) + total, 边界塞 '…'.
function buildPageList(
  current: number,
  total: number,
): readonly (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: (number | '…')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) result.push('…');
  for (let p = left; p <= right; p++) result.push(p);
  if (right < total - 1) result.push('…');
  result.push(total);
  return result;
}
