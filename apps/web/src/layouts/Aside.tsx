import { useMemo, useState } from 'react';
import { cn } from '@sikao/shared-utils';
import { useAsideOutlet, type AsideKey } from './useAsideOutlet';

/**
 * Aside — 平板横屏 (T1/T2/T3 landscape) 常驻右侧 320 三 tab 抽屉
 * (解析 / 笔记 / AI). content 由路由 view 通过 useAsideSet 注入,
 * 走 AsideOutletContext (PR15) 跨树读取.
 *
 * 来源 SSOT:
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §7.2-7.3
 *   - docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §3 (PR14)
 *   - docs/design/Mobile and Tablet Pack New.html (T1 横屏 .t-aside)
 *   - docs/plan/practice-center-mobile-tablet-redesign.md §4 PR11 + PR14
 *
 * 行为铁线:
 *   - **panels 空 → return null**: 路由 view 没注入任何 panel → 不渲染. PR14
 *     收纳态 32px 浮条只在 panels 非空时生效 (浮条空挂没用户价值).
 *   - **tab 切换**: useState 单选当前 tab. 默认选 panels 中第一个非空 key
 *     (analysis > notes > ask 顺序). caller 之后再注入新 key 不强制切到新 key,
 *     保留用户当前选中.
 *   - **缺失 panel 按钮 disabled**: panels[key] == null → tab button disabled.
 *   - **SVG-only 政策不适用本组件**: Aside tab 是 toolbar 内文字标签, 不在
 *     practice-svg-only 巡检范围 (CLAUDE.md §4 svg-only 仅限 button class 'q-foot' /
 *     practice / essay view 路径). Aside 是 layout-level chrome, 走文字 + 简洁
 *     a11y 不需要 IconBtn + Tooltip 双重保护.
 *   - **a11y**: role=tablist + 每个 tab role=tab + aria-selected + aria-controls
 *     映射到 tabpanel.
 *
 * 跟 AsideBottomBar 区分:
 *   - AsideBottomBar (PR15) = 平板**竖屏** + 移动端答题 bottom 3 IconBtn + BottomSheet.
 *   - Aside (本组件 PR11) = 平板**横屏** 常驻右侧 320 panel + 内置 3 tab 切换.
 *   - 两者跟同一 AsideOutletContext 协作, 同一路由 view 注入的 panel 双端复用.
 */

type AsideTabSpec = {
  readonly key: AsideKey;
  readonly label: string;
};

const TABS: readonly AsideTabSpec[] = [
  { key: 'analysis', label: '解析' },
  { key: 'notes', label: '笔记' },
  { key: 'ask', label: '问 AI' },
] as const;

function resolveDefaultTab(
  panels: Partial<Record<AsideKey, unknown>>,
): AsideKey | null {
  for (const tab of TABS) {
    if (panels[tab.key] != null) return tab.key;
  }
  return null;
}

interface AsideProps {
  /** 宽度 px, 默认 320 (Handoff §7.2 铁线 320w, 禁 ≥360 大宽度). */
  readonly width?: number;
  /** a11y 顶层 aria-label + 收纳态 (PR14) 浮条标签. */
  readonly label?: string;
  /**
   * 收纳态默认开关 (PR14, Handoff §3.3-3.4).
   *
   * - true: 默认 32px 浮条, 点击展开为 320 三 tab. 用于 T1 / TD1 / TD2 三处.
   * - false (默认): 直接渲染 320 三 tab (PR11 原行为).
   *
   * 注: PR14 只覆盖 T1 落点 (TabletShell landscape Aside). TD1 / TD2 默认
   * collapsed 等 PR13 ShenlunSession 落地后 view 自己传 true.
   */
  readonly defaultCollapsed?: boolean;
}

export function Aside({
  width = 320,
  label,
  defaultCollapsed = false,
}: AsideProps) {
  const panels = useAsideOutlet();
  const hasAnyPanel =
    panels !== null && Object.keys(panels).length > 0;

  // 用户显式 click 的 tab — null 表示走 default fallback.
  // 不用 effect 同步 panels → activeKey: 走 useMemo 派生 resolvedActiveKey,
  // userPick 有效且 panel 存在就用 userPick, 否则 fallback 到第一个非空 panel.
  // 这样 panels 异步注入 / 切换 tab / panel 被清空 都自动收敛, 无 setState-in-effect.
  const [userPick, setUserPick] = useState<AsideKey | null>(null);

  // PR14 收纳态. 走 useState 保持 caller 切 prop 不强制重置 (单方向初始).
  // 收纳态由用户 click 浮条 / 内置收起按钮控制, 不被 prop 反控.
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  const resolvedActiveKey = useMemo<AsideKey | null>(() => {
    if (panels === null) return null;
    // 用户 pick 仍有 panel → 走 pick
    if (userPick !== null && panels[userPick] != null) return userPick;
    // 否则 fallback 到第一个非空 panel
    return resolveDefaultTab(panels);
  }, [panels, userPick]);

  // panels 空 / Provider 缺失 → 不渲染 (PR14 浮条也要 panel 才显示, 否则
  // 路由 view 没注入面板时浮条空挂没用户价值).
  if (!hasAnyPanel) return null;
  if (panels === null) return null;

  // PR14 收纳态 32px 浮条 (Handoff §3.2). click / Enter / Space 展开.
  if (collapsed) {
    return (
      <aside
        className="t-aside is-collapsed"
        data-label={label ?? '面板'}
        data-testid="tablet-aside"
        role="button"
        tabIndex={0}
        aria-label={`展开 ${label ?? '面板'}`}
        onClick={() => setCollapsed(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed(false);
          }
        }}
      />
    );
  }

  const tablistLabel = label ?? '解析 / 笔记 / AI';
  const activeKey = resolvedActiveKey;
  const activePanel = activeKey !== null ? panels[activeKey] : null;

  return (
    <aside
      className="t-aside"
      style={{ width }}
      aria-label={label ?? '面板'}
      data-testid="tablet-aside"
    >
      <button
        type="button"
        className="t-aside__collapse"
        aria-label="收起面板"
        data-testid="tablet-aside-collapse"
        onClick={() => setCollapsed(true)}
      >
        ‹
      </button>
      <div
        role="tablist"
        aria-label={tablistLabel}
        className="t-aside__tablist"
      >
        {TABS.map((tab) => {
          const enabled = panels[tab.key] != null;
          const isActive = activeKey === tab.key;
          const panelId = `tablet-aside-panel-${tab.key}`;
          const tabId = `tablet-aside-tab-${tab.key}`;
          return (
            <button
              key={tab.key}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              disabled={!enabled}
              data-testid={`tablet-aside-tab-${tab.key}`}
              onClick={() => setUserPick(tab.key)}
              className={cn('t-aside__tab', isActive && 't-aside__tab--active')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeKey !== null ? (
        <div
          id={`tablet-aside-panel-${activeKey}`}
          role="tabpanel"
          aria-labelledby={`tablet-aside-tab-${activeKey}`}
          className="t-aside__panel"
          data-testid={`tablet-aside-panel-${activeKey}`}
        >
          {activePanel}
        </div>
      ) : null}
    </aside>
  );
}
