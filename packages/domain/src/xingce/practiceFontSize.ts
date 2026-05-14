import { useCallback, useEffect, useState } from 'react';

// Phase 3.5 fenbi-merge — 答题阅读区字号偏好 (sm/md/lg).
// 实现: root html 上 setAttribute data-practice-font, tokens.css 提供
// --practice-reading-fs 的 scoped override; PracticeDeck 容器用
// font-size: var(--practice-reading-fs) — CSS inherit 让题干/选项/材料
// 全部跟着变. 不影响 header / footer / sidebar.
//
// 不挂全局 zustand 主要因为: 这是 practice page-only 偏好, AppShell 的
// useThemeStore (全局 theme) 是另一回事. 直接 localStorage + useState 够用.

export type PracticeFontSize = 'sm' | 'md' | 'lg';

const STORAGE_KEY = 'sikao.practice.fontSize';
const VALID: readonly PracticeFontSize[] = ['sm', 'md', 'lg'];
const DOM_ATTR = 'data-practice-font';

function readFontSize(): PracticeFontSize {
  if (typeof window === 'undefined') return 'md';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored !== null && (VALID as readonly string[]).includes(stored)) {
    return stored as PracticeFontSize;
  }
  return 'md';
}

function writeFontSize(value: PracticeFontSize): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

/** 写到 html dom — useEffect 唯一调用方 (review-fix #2). */
export function applyFontSizeToDom(value: PracticeFontSize): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(DOM_ATTR, value);
}

export function usePracticeFontSize(): {
  readonly value: PracticeFontSize;
  readonly setValue: (next: PracticeFontSize) => void;
} {
  const [value, setState] = useState<PracticeFontSize>(readFontSize);
  const setValue = useCallback((next: PracticeFontSize) => {
    writeFontSize(next);
    setState(next);
    // DOM 写由 effect 唯一负责 (review-fix #2: 之前 setValue+effect 双写)
  }, []);
  // mount + value 变 → apply DOM. unmount 不复位: 字号偏好是跨页持久 UX 偏好
  // (跟 examTheme 不同), 留 attribute 让用户回 dashboard 也保持; StrictMode
  // dev 模式 mount→cleanup→mount 中间不会闪 (review-fix #3: 之前 cleanup
  // removeAttribute 触发 fallback 16px 一帧)
  useEffect(() => {
    applyFontSizeToDom(value);
  }, [value]);
  // 跨 tab 同步
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY) return;
      setState(readFontSize());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return { value, setValue };
}
