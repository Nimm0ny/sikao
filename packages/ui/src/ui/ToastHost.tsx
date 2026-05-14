import { useEffect, useState, type ReactElement } from 'react';
import { subscribe, type ToastItem, type ToastKind } from '@sikao/shared-utils';
import { Toast, type ToastTone } from './Toast';

// Frontend Style Guide v1 (PR3) primitive — global toast container + queue manager.
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .toast + §7 a11y aria-live.
//   - 队列管理: 同时最多 3 条 (老的先出)
//   - 位置: fixed bottom-right, z-index var(--z-toast) = 80
//   - 自动关: 4s (走 lib/toast.ts 内部 setTimeout, 本组件不重复)
//   - 无 close button (规范明确)
//   - aria-live="polite" (屏幕阅读器 / NVDA 兼容)
//
// 跟 lib/ToastHost.tsx (legacy) 关系:
//   - 旧 ToastHost (lib/) 走 rounded-card-lg + 自带 close button + warn-bg / danger-bg 底色
//   - 新 ToastHost (components/ui/) 走规范 ink-1 实底 + dot + 无 close (规范 §5)
//   - lib/ToastHost.tsx 转发 (deprecated, 兼容现有 import); 新代码 import 本文件.
//
// outer API 0 break: `toast.info()` / `toast.warn()` / `toast.error()` 调用方
// 不变 (走 lib/toast.ts), 本组件订阅 queue 自动渲染. lib/toast.ts kind enum
// (info | warn | error) → 规范 tone (info | warn | err) 映射在本文件做.

// queue cap (规范 §5 注: 同时最多 3 条).
const MAX_VISIBLE = 3;

// lib/toast.ts kind (info | warn | error) → 规范 tone (info | ok | warn | err).
// 当前 lib/toast.ts 无 'ok' kind; 等后续 ok 信号成熟再追加 (e.g. toast.success()).
function kindToTone(kind: ToastKind): ToastTone {
  switch (kind) {
    case 'info':
      return 'info';
    case 'warn':
      return 'warn';
    case 'error':
      return 'err';
  }
}

export function ToastHost(): ReactElement {
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  useEffect(() => subscribe(setItems), []);

  // queue 自动出栈 — lib/toast.ts setTimeout(dismiss, 4s) 已就位, 本组件只截 head.
  const visible = items.slice(-MAX_VISIBLE);

  return (
    <div
      aria-live="polite"
      role="region"
      aria-label="Notifications"
      // z-toast = var(--z-toast) = 80 (规范 §1 z-index)
      // bottom-right 跟规范 §5 toast 位置一致 (lib 旧版 top-right 跟规范不一致, 走规范)
      className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none"
      data-testid="toast-host"
    >
      {visible.map(t => (
        <Toast key={t.id} tone={kindToTone(t.kind)} className="pointer-events-auto">
          <span className="font-semibold">{t.title}</span>
          {t.description ? (
            <span className="ml-1 opacity-80">— {t.description}</span>
          ) : null}
        </Toast>
      ))}
    </div>
  );
}
