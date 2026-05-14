/**
 * useScrollSpyTab — IntersectionObserver-based scroll spy.
 *
 * 监听 N 个 anchor section, 返回当前 viewport 内最靠上的 section id.
 * 给 ResultTabNav 高亮 active tab 用.
 *
 * rootMargin '-100px 0px -50% 0px' = sticky tab nav 高度大约 ~48px + 顶部
 * 缓冲, 底部去掉 50% 让 section 至少进入上半屏才算 active.
 */
import { useEffect, useState } from 'react';

export function useScrollSpyTab(sectionIds: ReadonlyArray<string>): string {
  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? '');

  useEffect(() => {
    if (sectionIds.length === 0) return;
    // SSR / jsdom polyfill 缺失场景, fallback 到默认 activeId, 不崩.
    if (typeof IntersectionObserver === 'undefined') return;
    const observers: IntersectionObserver[] = [];
    const visible = new Set<string>();

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el === null) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const sid = entry.target.id;
            if (entry.isIntersecting) visible.add(sid);
            else visible.delete(sid);
          }
          // pick 当前 visible 中 sectionIds 顺序最靠前的
          for (const candidate of sectionIds) {
            if (visible.has(candidate)) {
              setActiveId(candidate);
              return;
            }
          }
        },
        { rootMargin: '-100px 0px -50% 0px', threshold: 0 },
      );

      observer.observe(el);
      observers.push(observer);
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [sectionIds]);

  return activeId;
}
