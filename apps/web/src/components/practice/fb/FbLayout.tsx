import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// SIKAO Phase 3 (2026-05-09) → Wave 9 Phase 2a (2026-05-12) 3 档 responsive:
//   - ≤768 (mobile): 沉浸单栏 reader-first — 右栏 FAB+sheet (走 FbScratchFab +
//     FbMobileScratchSheet, 由 caller 控)
//   - 769-1023 (tablet): 紧凑双栏 hybrid — reading-col + 280px 窄右栏
//   - 1024-1366 (desktop default): 双栏 reading + 280px scratch sticky
//   - ≥1367 (xl-laptop+): 双栏宽 1.5fr / 1fr 高密信息
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md + docs/design/mobile-style-guide.md §1.3.
// mobile 内边距 px-4 (vs desktop px-6) 与 mobile-style-guide §4.2 间距更紧约束对齐.
// bottom 留 pb-tabbar 让 sticky FbBottomDock + iOS home indicator 不遮内容.
//
// Dumb by contract: 仅 layout chrome.

export interface FbLayoutProps {
  readonly readingCol: ReactNode;
  readonly scratchCol: ReactNode;
}

export function FbLayout({ readingCol, scratchCol }: FbLayoutProps) {
  return (
    <main
      className={cn(
        'mx-auto w-full max-w-[1280px] px-4 md:px-6 py-8 md:py-12 xl-laptop:py-16',
        'pb-tabbar',
        'grid gap-6 md:gap-8 xl-laptop:gap-16',
        // <768 单栏 (mobile FAB+sheet); 769-1023 (md-lg) 双栏紧凑 280px 右栏;
        // 1024-1366 (lg) 双栏窄右; ≥1367 (xl-laptop) 双栏宽右.
        'grid-cols-1',
        'md:grid-cols-[minmax(0,1fr)_minmax(0,280px)]',
        'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,280px)]',
        'xl-laptop:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]',
        'items-start',
      )}
      data-testid="fb-layout"
    >
      <section className="reading-col min-w-0 max-w-[720px] mx-auto md:mx-0 w-full">
        {readingCol}
      </section>
      <div className="scratch-col-wrap hidden md:block min-w-0">{scratchCol}</div>
    </main>
  );
}
