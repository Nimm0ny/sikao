import { createContext, useContext, useEffect, type ReactNode } from 'react';

/**
 * AsideOutlet context + hooks (PR15, 2026-05-13).
 *
 * 拆独立文件是 eslint react-refresh/only-export-components 强约束 — Provider
 * component 跟 hooks/context object 不能同文件 export. Provider 在 AsideOutlet.tsx,
 * 这里只放 hooks + types + context 对象.
 *
 * 来源 SSOT:
 *   - docs/plan/practice-center-mobile-tablet-redesign.md §4 PR15
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §7.3
 */

export type AsideKey = 'analysis' | 'notes' | 'ask';

export type AsidePanels = Partial<Record<AsideKey, ReactNode>>;

export interface AsideOutletValue {
  readonly panels: AsidePanels;
  readonly setPanel: (key: AsideKey, node: ReactNode | null) => void;
}

export const AsideOutletContext = createContext<AsideOutletValue | null>(null);

/**
 * 读当前 panels map (AsideBottomBar / Aside 使用).
 * Provider 缺失 → 返回 null (允许在非 AppShell 路由 e.g. Login mount 时不炸).
 */
export function useAsideOutlet(): AsidePanels | null {
  const ctx = useContext(AsideOutletContext);
  if (ctx === null) return null;
  return ctx.panels;
}

/**
 * 路由 view 注入 panel 节点. mount 时 set, unmount 时清.
 * 参数 node 变化时自动 re-set.
 *
 * 用法:
 *   useAsideSet('analysis', <PracticeAnalysisPanel questionId={qid} />);
 *
 * Provider 缺失 → no-op (允许 view 复用到不挂 Aside 的 shell e.g. mobile).
 */
export function useAsideSet(key: AsideKey, node: ReactNode | null): void {
  const ctx = useContext(AsideOutletContext);
  const setPanel = ctx?.setPanel;
  useEffect(() => {
    if (setPanel === undefined) return undefined;
    setPanel(key, node);
    return () => {
      setPanel(key, null);
    };
  }, [setPanel, key, node]);
}
