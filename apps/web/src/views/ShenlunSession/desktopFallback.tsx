import type { ReactElement } from 'react';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

// Desktop / mobile 用户访问此 route 时给一个明确指引, 不渲染半成品布局.

export default function DesktopFallback(): ReactElement {
  return (
    <div
      data-testid="shenlun-desktop-fallback"
      className="flex h-full w-full items-center justify-center bg-paper-1 px-6 text-ink-3"
    >
      <p className="max-w-prose text-center">{ESSAY_SIKAO_COPY.shenlunDesktopFallback}</p>
    </div>
  );
}
