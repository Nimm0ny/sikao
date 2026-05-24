// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.5 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useState } from 'react';
import { Badge, Chip, SpriteIcon } from '../../components/atom';
import { Pagination } from '../../components/nav';
import { Panel, PageHeader } from '../../components/layout';
import styles from './QuestionHub.module.css';

/*
 * Question Hub view — V5 D.4.5 desktop page skeleton.
 *
 * Why: container tree per design.md §D.4.5 — 3-row Workspace grid:
 *      header → FilterBar (chips multi-select：科目 / 题型 / 错题状态)
 *      → Panel containing a 3-col compact-card grid (--card-radius-sm
 *      12px, denser than Practice's 4-col specialty grid). Pagination is
 *      rendered in the Panel's trailing slot in size="sm" (compact mode
 *      per task 17.5 verification — 紧凑模式).
 *
 *      Hub vs Review (D.4.5): both share this skeleton. Review (task 17.6)
 *      will compose this layout + a复习日历 picker — that's a separate
 *      view in commit 6 to keep Hub minimal.
 */

type Subject = 'all' | 'xc' | 'sl';
type QuestionType = 'all' | 'single' | 'multi' | 'judge' | 'fillin';
type MistakeState = 'all' | 'unsolved' | 'mastered';

const SUBJECT_OPTIONS: ReadonlyArray<{ readonly key: Subject; readonly label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'xc', label: '行测' },
  { key: 'sl', label: '申论' },
];

const TYPE_OPTIONS: ReadonlyArray<{ readonly key: QuestionType; readonly label: string }> = [
  { key: 'all', label: '全部题型' },
  { key: 'single', label: '单选' },
  { key: 'multi', label: '多选' },
  { key: 'judge', label: '判断' },
  { key: 'fillin', label: '填空' },
];

const STATE_OPTIONS: ReadonlyArray<{ readonly key: MistakeState; readonly label: string }> = [
  { key: 'all', label: '全部状态' },
  { key: 'unsolved', label: '未掌握' },
  { key: 'mastered', label: '已掌握' },
];

interface QuestionCard {
  readonly id: string;
  readonly number: number;
  readonly cat: { readonly variant: 'cat-yanyu' | 'cat-shuliang' | 'cat-panduan' | 'cat-ziliao' | 'cat-shenlun'; readonly label: string };
  readonly state: 'unsolved' | 'mastered' | 'doing';
}

const PLACEHOLDER_QUESTIONS: ReadonlyArray<QuestionCard> = Array.from({ length: 24 }, (_, i): QuestionCard => {
  const cats: ReadonlyArray<QuestionCard['cat']> = [
    { variant: 'cat-yanyu', label: '言语' },
    { variant: 'cat-shuliang', label: '数量' },
    { variant: 'cat-panduan', label: '判断' },
    { variant: 'cat-ziliao', label: '资料' },
    { variant: 'cat-shenlun', label: '申论' },
  ];
  const states: ReadonlyArray<QuestionCard['state']> = ['unsolved', 'mastered', 'doing'];
  return {
    id: `q${i + 1}`,
    number: 2024_0000 + i + 1,
    cat: cats[i % cats.length],
    state: states[i % states.length],
  };
});

function StateGlyph({ state }: { readonly state: QuestionCard['state'] }) {
  if (state === 'mastered') {
    return <SpriteIcon id="check" size={14} aria-label="已掌握" />;
  }
  if (state === 'doing') {
    // "doing" reuses the timer icon as a "in-progress" semantic. Sprite
    // doesn't ship a dedicated half-circle / spinner glyph at this size.
    return <SpriteIcon id="timer" size={14} aria-label="进行中" />;
  }
  return <SpriteIcon id="close" size={14} aria-label="未掌握" />;
}

interface FilterChipProps {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <Chip size="sm" active={active} onSelect={onClick}>
      {label}
    </Chip>
  );
}

const PAGE_SIZE = 12;

export function QuestionHub() {
  const [subject, setSubject] = useState<Subject>('all');
  const [qtype, setQtype] = useState<QuestionType>('all');
  const [mistake, setMistake] = useState<MistakeState>('all');
  const [page, setPage] = useState(1);

  return (
    <div className={styles.root} data-testid="question-hub-view">
      <PageHeader title="题库" subtitle="按科目 / 题型 / 状态浏览题目" />

      <div className={styles.filterBar} data-testid="hub-filter-bar" aria-label="题目筛选">
        <span className={styles.filterGroup} aria-label="科目">
          {SUBJECT_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.key}
              label={opt.label}
              active={subject === opt.key}
              onClick={() => setSubject(opt.key)}
            />
          ))}
        </span>
        <span className={styles.filterGroup} aria-label="题型">
          {TYPE_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.key}
              label={opt.label}
              active={qtype === opt.key}
              onClick={() => setQtype(opt.key)}
            />
          ))}
        </span>
        <span className={styles.filterGroup} aria-label="错题状态">
          {STATE_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.key}
              label={opt.label}
              active={mistake === opt.key}
              onClick={() => setMistake(opt.key)}
            />
          ))}
        </span>
      </div>

      <Panel
        title="题目列表"
        trailing={
          <Pagination
            current={page}
            total={PLACEHOLDER_QUESTIONS.length}
            pageSize={PAGE_SIZE}
            size="sm"
            onChange={(next) => setPage(next)}
          />
        }
      >
        <div
          className={styles.compactGrid}
          data-testid="hub-grid"
          role="list"
          aria-label="题目网格"
        >
          {PLACEHOLDER_QUESTIONS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((q) => (
            <article
              key={q.id}
              className={styles.compactCard}
              role="listitem"
              data-testid={`hub-card-${q.id}`}
              data-state={q.state}
            >
              <span className={styles.compactHeader}>
                <span className={styles.compactNumber}>#{q.number}</span>
                <Badge variant={q.cat.variant} size="sm">{q.cat.label}</Badge>
              </span>
              <span className={styles.compactState} data-state={q.state}>
                <StateGlyph state={q.state} />
              </span>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
