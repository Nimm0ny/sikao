import { useCallback, useEffect, useState } from 'react';

/**
 * 行测答题视图模式 SSOT（R2.4 抽自 apps/web/src/components/practice/ViewModeToggle）。
 *   deck   —— 卡片切题（默认）
 *   scroll —— 全卷滚动（Wave D 落地）
 */
export type PracticeViewMode = 'deck' | 'scroll';

// Phase 3.4 fenbi-merge — 答题视图模式 (deck/scroll) 偏好持久化.
// localStorage 直读直写, 切换无需经后端. SSR 不适用 (本项目纯 SPA).
//
// 默认 deck — scroll 模式 Wave D 才落地. scrollDisabled 期间 read 时把
// localStorage 残值 'scroll' 规约回 'deck' (review-fix #5: 否则 UI 显示
// scroll 高亮但实际渲染 deck 不一致).

const STORAGE_KEY = 'sikao.practice.viewMode';
const VALID_MODES: readonly PracticeViewMode[] = ['deck', 'scroll'];

function readViewMode(scrollDisabled: boolean): PracticeViewMode {
  if (typeof window === 'undefined') return 'deck';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored !== null && (VALID_MODES as readonly string[]).includes(stored)) {
    const mode = stored as PracticeViewMode;
    if (mode === 'scroll' && scrollDisabled) return 'deck';
    return mode;
  }
  return 'deck';
}

function writeViewMode(mode: PracticeViewMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function useViewModePreference(scrollDisabled: boolean = true): {
  readonly value: PracticeViewMode;
  readonly setValue: (mode: PracticeViewMode) => void;
} {
  const [value, setState] = useState<PracticeViewMode>(() =>
    readViewMode(scrollDisabled),
  );
  const setValue = useCallback((mode: PracticeViewMode) => {
    writeViewMode(mode);
    setState(mode);
  }, []);
  // 跨 tab 同步 — 用户在 tab A 切了视图模式, tab B 应该感知.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY) return;
      setState(readViewMode(scrollDisabled));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [scrollDisabled]);
  return { value, setValue };
}
