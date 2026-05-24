// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.5 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useState } from 'react';
import { Badge } from '../../components/atom';
import { DatePicker } from '../../components/form';
import { Pagination } from '../../components/nav';
import { Panel, PageHeader } from '../../components/layout';
import styles from './Review.module.css';

/*
 * Review view — V5 D.4.5 desktop page skeleton (Hub style + 复习日历).
 *
 * Why: container tree per design.md §D.4.5 — same compact 3-col grid as
 *      QuestionHub but with a 复习日历 (DatePicker) header bar that
 *      drives the active review queue. DatePicker uses the default
 *      presets (今天 / 明天 / 下周一 per design §D.3.14 + task 17.6
 *      verification). compact-card density matches QuestionHub
 *      (--card-radius-sm 12px) per spec §D.4.5 "Hub / Review same
 *      visual" rule.
 *
 *      Skeleton renders a静态 mistake-status filter chip group + a
 *      DatePicker for the复习日 + a 3-col compact-grid of due-date
 *      mistake cards. Real review-queue API + due-date scheduling lands
 *      with the Review business Phase (SIK-45 family).
 */

type MistakeState = 'all' | 'overdue' | 'today' | 'upcoming';

const STATE_OPTIONS: ReadonlyArray<{ readonly key: MistakeState; readonly label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'overdue', label: '逾期' },
  { key: 'today', label: '今日' },
  { key: 'upcoming', label: '未来' },
];

interface ReviewCard {
  readonly id: string;
  readonly number: number;
  readonly cat: { readonly variant: 'cat-yanyu' | 'cat-shuliang' | 'cat-panduan' | 'cat-ziliao' | 'cat-shenlun'; readonly label: string };
  readonly dueLabel: string;
  readonly overdue: boolean;
}

const PLACEHOLDER_REVIEWS: ReadonlyArray<ReviewCard> = Array.from({ length: 18 }, (_, i): ReviewCard => {
  const cats: ReadonlyArray<ReviewCard['cat']> = [
    { variant: 'cat-yanyu', label: '言语' },
    { variant: 'cat-shuliang', label: '数量' },
    { variant: 'cat-panduan', label: '判断' },
    { variant: 'cat-ziliao', label: '资料' },
    { variant: 'cat-shenlun', label: '申论' },
  ];
  const dueLabels = ['今天', '明天', '逾期 2 天', '后天', '下周一', '逾期 5 天'];
  const dueLabel = dueLabels[i % dueLabels.length];
  return {
    id: `rv${i + 1}`,
    number: 2024_5000 + i + 1,
    cat: cats[i % cats.length],
    dueLabel,
    overdue: dueLabel.includes('逾期'),
  };
});

interface FilterChipProps {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-active={active ? 'true' : undefined}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

const PAGE_SIZE = 9;

export function Review() {
  const [state, setState] = useState<MistakeState>('all');
  const [date, setDate] = useState<Date | null>(() => new Date());
  const [page, setPage] = useState(1);

  const visible = PLACEHOLDER_REVIEWS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className={styles.root} data-testid="review-view">
      <PageHeader title="复盘" subtitle="错题与复习日历" />

      <div className={styles.filterBar} data-testid="review-filter-bar" aria-label="错题状态">
        <span className={styles.filterGroup} aria-label="错题状态">
          {STATE_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.key}
              label={opt.label}
              active={state === opt.key}
              onClick={() => setState(opt.key)}
            />
          ))}
        </span>
      </div>

      <div className={styles.calendarBar} data-testid="review-calendar-bar">
        <span className={styles.calendarLabel}>复习日</span>
        <DatePicker value={date} onChange={setDate} aria-label="复习日" />
        <span className={styles.calendarMeta} data-testid="review-calendar-meta">
          {visible.length} 题待复盘
        </span>
      </div>

      <Panel
        title="错题列表"
        trailing={
          <Pagination
            current={page}
            total={PLACEHOLDER_REVIEWS.length}
            pageSize={PAGE_SIZE}
            size="sm"
            onChange={(next) => setPage(next)}
          />
        }
      >
        <div
          className={styles.compactGrid}
          data-testid="review-grid"
          role="list"
          aria-label="错题网格"
        >
          {visible.map((q) => (
            <article
              key={q.id}
              className={styles.compactCard}
              role="listitem"
              data-testid={`review-card-${q.id}`}
            >
              <span className={styles.compactHeader}>
                <span className={styles.compactNumber}>#{q.number}</span>
                <Badge variant={q.cat.variant} size="sm">{q.cat.label}</Badge>
              </span>
              <span className={styles.compactDue} data-overdue={q.overdue ? 'true' : undefined}>
                {q.dueLabel}
              </span>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
