// lint-allow-ui-copy: V5 ProfileLearning range-bar copy. CJK strings are
// visual contract from `Profile Learning v1.html` lines 24-37.
import styles from './RangeBar.module.css';
import { Button } from '../../components/form';

/*
 * RangeBar — ProfileLearning range selector.
 *
 * Why: sik-fu-b §2.3 — 4 seg pills (本周 / 最近 30 天 / 最近 90 天 / 全部)
 *      + date picker (placeholder, disabled in W1) + sub text + compare
 *      button (placeholder, disabled in W1).
 *
 *      AGENT-H7: rangeKey is required and constrained to the literal
 *      union; no `?? defaultValue`. Caller owns the state.
 */

export type RangeKey = 'week' | '30d' | '90d' | 'all';

interface RangeOption {
  readonly key: RangeKey;
  readonly label: string;
}

const RANGES: ReadonlyArray<RangeOption> = [
  { key: 'week', label: '本周' },
  { key: '30d',  label: '最近 30 天' },
  { key: '90d',  label: '最近 90 天' },
  { key: 'all',  label: '全部' },
];

export interface RangeBarProps {
  readonly active: RangeKey;
  readonly onChange: (next: RangeKey) => void;
}

export function RangeBar({ active, onChange }: RangeBarProps) {
  return (
    <div className={styles.root} data-testid="profile-learning-range-bar">
      <div className={styles.left}>
        <div className={styles.segPills} role="tablist" aria-label="时间范围">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === active}
              className={styles.pill}
              data-active={r.key === active || undefined}
              onClick={() => onChange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className={styles.subText}>
          数据更新于 5 分钟前 · 含今日实时数据
        </span>
      </div>
      <div className={styles.right}>
        <input
          type="date"
          className={styles.datePicker}
          aria-label="自定义开始日期"
          disabled
          title="自定义日期范围占位（待 SIK-FU-N）"
        />
        <Button variant="secondary" size="sm" disabled aria-label="对比上一周期 (占位，待 SIK-FU-N)">
          对比上一周期
        </Button>
      </div>
    </div>
  );
}
