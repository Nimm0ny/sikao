import type { ReactNode } from 'react';
import { LogoMark } from '@sikao/ui/brand/LogoMark';

// commit #6j: auth view shell — 9 个 auth view (Login/RegEmail/RegPhone/Forgot/
// Reset/Verify/BindEmail/BindPhone/CompleteProfile) 共用 v1-minimal claude.com
// 风的外框 + 卡片 + 品牌头. 抽出来减重复 + future 全局调风一处改.
//
// max width 默认 400px (单列表单), CompleteProfile tab 视图用 440px.
//
// rightSlot 给 CompleteProfile 顶部"退出"按钮; 普通 view 不传.
//
// Wave 9 Phase 1 responsive (2026-05-12, mobile-style-guide §1.3 决议):
//   ≤768 mobile  — 外框 p-4, 卡片 px-5 pt-8 pb-7, brand mark mb-6
//   769-1023 tablet — md: 外框 p-6, 卡片 px-8 pt-10 pb-8, brand mark mb-8
//   ≥1024 desktop — lg: 沿用 tablet 尺寸 (auth view 在 desktop 仍然居中卡片,
//     不放大), 维持视觉一致.
// mobile 减 padding 让 375px viewport 上输入框两侧留白合理 (8px outer +
// 20px inner = 28px 边距, 与 mobile-style-guide §3 主 CTA `h-12 全宽` 兼容).

export interface AuthShellProps {
  readonly children: ReactNode;
  readonly testId?: string;
  readonly maxWidthClass?: string;
  readonly rightSlot?: ReactNode;
}

export function AuthShell({
  children,
  testId,
  maxWidthClass = 'max-w-[400px]',
  rightSlot,
}: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-paper-2 p-4 md:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-80"
        style={{
          background:
            'radial-gradient(circle at top left, color-mix(in oklch, var(--accent-1), white 84%), transparent 58%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-72px] left-[-72px] h-40 w-40 rounded-pill border border-line opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-8 top-12 h-20 w-20 rounded-pill border border-line opacity-60"
      />
      <div
        className={`relative w-full ${maxWidthClass} rounded-card-lg border border-line bg-paper-1 px-5 pb-7 pt-8 shadow-card md:px-8 md:pb-8 md:pt-10`}
        data-testid={testId}
      >
        {rightSlot !== undefined ? (
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <BrandMark />
            {rightSlot}
          </div>
        ) : (
          <div className="mb-6 md:mb-8">
            <BrandMark />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="inline-flex items-center gap-2">
      <LogoMark size={28} />
      <span className="text-md font-semibold text-ink">思考</span>
    </div>
  );
}
