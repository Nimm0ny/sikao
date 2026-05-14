import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Phase 3.6 fenbi-merge — D3 决策: 「考场态」三页 (答题/报告/申论考场)
// 共用夜间; 离开考场态自动切回日间. 这跟之前 Phase 4.3 的"全站 light/dark"
// 行为相反 — 用户在 dashboard / 题库 / 错题本只看 light, dark 是答题专属.
//
// 实现:
//   - examTheme: localStorage 持久化的偏好 ('light' | 'dark', 默认 light)
//   - useApplyExamTheme(): 在考场态 view (PracticeSession / Result /
//     EssayExam) 第一行调用. mount 时 setAttribute(html, data-theme,
//     examTheme); unmount 时切回 'light'. 200ms CSS transition (body 上
//     background-color/color) 给离场 fade.
//   - 偏好切换仍然瞬时生效 (toggle 调 setExamTheme → 同时刷新 localStorage
//     + DOM, 已挂载的 view 还在守卫里所以 attr 跟着变).

export type Theme = 'light' | 'dark';

interface ThemeState {
  readonly examTheme: Theme;
  readonly setExamTheme: (next: Theme) => void;
  readonly toggleExamTheme: () => void;
}

const STORAGE_KEY = 'sikao.examTheme';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      examTheme: 'light',
      setExamTheme: (next) => set({ examTheme: next }),
      toggleExamTheme: () =>
        set({ examTheme: get().examTheme === 'light' ? 'dark' : 'light' }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ examTheme: state.examTheme }),
    },
  ),
);

/** Sync 一个 theme 值到 <html data-theme="..."> — 内部 helper. */
function applyThemeToDom(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

/** Cleanup helper: 离开考场态时移除 data-theme attribute (review-fix #7). */
function clearThemeFromDom(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute('data-theme');
}

/**
 * 考场态路由守卫 — 在 PracticeSession / Result / EssayExam /
 * EssayGradingResult view 第一行调用.
 *
 * Mount: 把 examTheme 应用到 <html data-theme>. 已挂载期间 examTheme 切换
 * 同步反映到 DOM (subscribe).
 *
 * Unmount: removeAttribute('data-theme') — D3 决策, 离开考场态复位日间.
 * 用 removeAttribute 而非 apply('light') 让默认态语义干净 (无 attr =
 * tokens.css :root 默认 light), 避免 dashboard 看到 <html data-theme="light">
 * 残值 (review-fix #7).
 *
 * 多 view 同时挂载假设: react-router 默认 sync 切换不双 mount. 若未来引入
 * AnimatePresence(mode='popLayout' 等) 让旧 view exit 期间新 view 已 mount,
 * 这里需加 ref counter (推 follow-up, 当前 router 不触发).
 */
export function useApplyExamTheme(): void {
  const examTheme = useThemeStore((s) => s.examTheme);
  useEffect(() => {
    applyThemeToDom(examTheme);
    return () => {
      clearThemeFromDom();
    };
  }, [examTheme]);
}
