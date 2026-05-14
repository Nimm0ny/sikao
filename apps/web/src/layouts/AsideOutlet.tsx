import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AsideOutletContext,
  type AsideKey,
  type AsideOutletValue,
  type AsidePanels,
} from './useAsideOutlet';

/**
 * AsideOutlet — 当前路由 view 把"解析 / 笔记 / AI"3 个 panel 节点注入
 * 全局 slot, 让 TabletShell portrait 的 AsideBottomBar (PR15 §A) +
 * landscape 的 Aside (PR11) 跨树读取并渲染.
 *
 * 来源 SSOT:
 *   - docs/plan/practice-center-mobile-tablet-redesign.md §4 PR15
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §7.3
 *   - docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §4
 *
 * 用法:
 *   AppShell 顶层挂 <AsideOutletProvider>; 路由 view 内调用 useAsideSet('analysis', <PracticeAnalysisPanel />)
 *   注入 node, AsideBottomBar / Aside 通过 useAsideOutlet() 读 panels map.
 *   view unmount 自动清, 不残留. 同一 view 内 useAsideSet 调用顺序固定即可.
 *
 * 设计选择:
 *   - 三类 panel 走 key (analysis / notes / ask) 不是 array — Bottom 3 button
 *     一对一对应, 简化 BottomSheet 内部寻找逻辑.
 *   - panel 缺失 (caller 没 set) → key 不存在 panels map, AsideBottomBar 内部
 *     判 null 灰按钮 disable.
 *   - useAsideSet 走 useEffect mount/unmount lifecycle 保证 view 离开自动清.
 *   - 文件拆分 (context + hooks 在 useAsideOutlet.ts, Provider 在本 .tsx) 是
 *     eslint react-refresh/only-export-components 强约束.
 */

interface AsideOutletProviderProps {
  readonly children: ReactNode;
}

export function AsideOutletProvider({ children }: AsideOutletProviderProps) {
  const [panels, setPanels] = useState<AsidePanels>({});
  const setPanel = useCallback((key: AsideKey, node: ReactNode | null) => {
    setPanels((prev) => {
      // null → 清 key (delete vs undefined: 用 spread + delete 保引用变化)
      if (node === null || node === undefined) {
        if (prev[key] == null) return prev;
        const next: AsidePanels = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === node) return prev;
      return { ...prev, [key]: node };
    });
  }, []);
  const value = useMemo<AsideOutletValue>(
    () => ({ panels, setPanel }),
    [panels, setPanel],
  );
  return (
    <AsideOutletContext.Provider value={value}>
      {children}
    </AsideOutletContext.Provider>
  );
}
