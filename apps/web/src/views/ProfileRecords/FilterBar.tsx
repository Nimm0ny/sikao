// lint-allow-ui-copy: V5 ProfileRecords filter-bar copy. CJK strings are
// visual contract from `Profile Records v1.html` lines 169-180.
import { Button } from '../../components/form';
import styles from './FilterBar.module.css';

/*
 * FilterBar — ProfileRecords filter bar.
 *
 * Why: sik-fu-c §2.2 — in-page activity-kind filter (NOT global nav, no
 *      H12 implication). Five seg pills (全部活动 / 练习 / 模考 / 复盘 / 笔记)
 *      + date picker (placeholder, wave 3) + sub text + 仅看里程碑 button
 *      (placeholder, wave 3).
 *
 *      AGENT-H7: filter values are required props; no `?? defaultValue`.
 *      Caller owns the filter state; this component is purely presentational.
 *
 *      kind binding: backend only emits 2 canonical kinds today
 *      (`xingce_practice` / `essay_submission`). The 5 pills mirror the
 *      prototype's 5 visual buckets; pills that don't yet map to a backend
 *      kind disable themselves with a title hint so the UI stays honest.
 */

export type RecordKindFilter = 'all' | 'practice' | 'mock' | 'review' | 'note';

interface KindOption {
  readonly key: RecordKindFilter;
  readonly label: string;
  /** Maps the visual filter bucket to the backend `kind` query param. */
  readonly backendKind: string | undefined;
  /** True when at least one record source emits this kind today. */
  readonly enabled: boolean;
}

const KIND_OPTIONS: ReadonlyArray<KindOption> = [
  { key: 'all',      label: '全部活动', backendKind: undefined,           enabled: true  },
  { key: 'practice', label: '练习',     backendKind: 'xingce_practice',   enabled: true  },
  { key: 'mock',     label: '模考',     backendKind: undefined,           enabled: false },
  { key: 'review',   label: '复盘',     backendKind: undefined,           enabled: false },
  { key: 'note',     label: '笔记',     backendKind: undefined,           enabled: false },
];

export interface FilterBarProps {
  readonly active: RecordKindFilter;
  readonly onChange: (next: RecordKindFilter, backendKind: string | undefined) => void;
  /** Total record count after filter applied; rendered in sub text. */
  readonly total: number;
  /** Date range sub-text (start → end); empty string when no records. */
  readonly rangeLabel: string;
}

export function FilterBar({ active, onChange, total, rangeLabel }: FilterBarProps) {
  return (
    <div className={styles.root} data-testid="profile-records-filter">
      <div
        className={styles.segPills}
        role="tablist"
        aria-label="活动类型"
      >
        {KIND_OPTIONS.map((option) => {
          const isActive = option.key === active;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={isActive ? true : false}
              aria-disabled={!option.enabled}
              disabled={!option.enabled}
              className={styles.pill}
              data-active={isActive || undefined}
              data-kind={option.key}
              title={option.enabled ? undefined : '此筛选项尚未开放（待对应记录类型上线）'}
              onClick={() => onChange(option.key, option.backendKind)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <span className={styles.dividerY} aria-hidden="true" />

      <input
        type="date"
        className={styles.datePicker}
        aria-label="自定义起始日期"
        disabled
        title="自定义日期范围占位（待 SIK-FU-N）"
      />

      <span className={styles.dividerY} aria-hidden="true" />

      <span className={styles.subText} data-testid="profile-records-summary">
        {rangeLabel === '' ? `共 ${total} 项活动` : `${rangeLabel} · ${total} 项活动`}
      </span>

      <Button
        variant="secondary"
        size="sm"
        disabled
        className={styles.milestoneBtn}
        aria-label="仅看里程碑 (占位，待 SIK-FU-N)"
      >
        仅看里程碑
      </Button>
    </div>
  );
}
