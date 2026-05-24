import { Tabs } from '../../nav/Tabs';
import type { TabItem } from '../../nav/Tabs';

/*
 * ScopeToggle — V5 D.3.3 business alias (R2/Q2 decision).
 *
 * Why: design.md §D.3.3 mandates that "scope toggle" (e.g. 行测 / 申论 切换
 *      数据范围) is NOT a separate component — it is the segmented variant
 *      of Tabs. We expose ScopeToggle as a thin semantic wrapper so reading
 *      product code reveals intent ("toggle data scope") without inviting
 *      a parallel visual implementation. This file MUST NOT introduce any
 *      visual or behavior of its own beyond renaming the prop set.
 */

export interface ScopeToggleItem {
  readonly key: string;
  readonly label: string;
}

export interface ScopeToggleProps {
  readonly scopes: ReadonlyArray<ScopeToggleItem>;
  readonly active: string;
  readonly onChange: (key: string) => void;
  readonly 'aria-label'?: string;
}

export function ScopeToggle({ scopes, active, onChange, 'aria-label': ariaLabel }: ScopeToggleProps) {
  const items: TabItem[] = scopes.map((s) => ({ key: s.key, label: s.label }));
  return (
    <Tabs
      variant="segmented"
      items={items}
      active={active}
      onChange={onChange}
      noPanel
      aria-label={ariaLabel}
    />
  );
}
