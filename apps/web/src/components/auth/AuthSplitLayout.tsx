import type { ReactNode } from 'react';
import { LoginArtPanel } from './LoginArtPanel';

// SIKAO Redesign Wave 1 · 01 Login 二段式 layout shell.
//
// hifi spec: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
//   line 1102-1162 (.login-shell + .login-art + .login-form).
//
// 左 LoginArtPanel (ink editorial 面板) + 右 form 面板 (paper 浅底). md 以下
// 左侧 hidden 让 form 全宽居中 (LoginArtPanel 自己负责 hidden lg:flex).
//
// 跟 AuthShell 区分:
//   - AuthShell: 旧 v1-minimal 单卡居中, ForgotPassword / ResetPassword /
//     VerifyEmail / BindEmail / BindPhone / CompleteProfile 8+ view 共用,
//     不动 (改它撕裂太多 view).
//   - AuthSplitLayout: 新 hifi 二段式, 仅 Login / RegisterEmail / RegisterPhone
//     3 view 用 (这 3 个是 brand 入口, 视觉最重要).
//
// P2 Reading Spread 落地 (2026-05-12 lhr 拍板):
//   - grid form column 用 clamp(420px, 32%, 580px) 而非固定 480, 让 form
//     跟 viewport 比例 scale (≤1500 viewport 28% 不足 420 走 min 420;
//     1500-2000 viewport 32% 自然 scale; ≥1800 cap 在 580 防 input 太宽稀).
//   - art panel 整列 1fr 全程 fluid, art content (quote/window/meta) 由
//     LoginArtPanel 内部用 clamp() 真 viewport-aware 字号 / sizes 自然填满
//     art column, 1024-4K viewport 无失衡.
//   - 0 max-width cap 在整 shell — 桌面任意宽度 viewport-flex 自动 scale.
//   - 平板横屏 (1024-1366) lg 触发双栏 + scale; 竖屏 (<1024) form-only.
//   - 手机 (<768) form-only 竖屏.
//   - 入场动画 + ambient + hover 详 LoginArtPanel.tsx + index.css `.auth-anim-up`.
//   - 不再消费 --auth-form-w CSS custom prop (formWidth prop 已删).

export interface AuthSplitLayoutProps {
  readonly children: ReactNode;
  readonly testId?: string;
  /** 自定义左 art 面板的主标语 highlight + strike (默认 思考 / 刷题). */
  readonly artHighlight?: string;
  readonly artStrike?: string;
}

export function AuthSplitLayout({
  children,
  testId,
  artHighlight,
  artStrike,
}: AuthSplitLayoutProps) {
  return (
    <div
      className="min-h-screen w-full bg-paper grid lg:grid-cols-[1fr_clamp(420px,32%,580px)]"
      data-testid={testId}
    >
      <LoginArtPanel highlight={artHighlight} strike={artStrike} />
      {/* mobile (≤768) art panel hidden + form 全宽 px-5/py-10 (跟 §3 page
          18px 边距同口径, 5*4=20px);
          tablet (769-1023) art panel 仍 hidden (双栏会撑爆 art 内容),
          form 居中 max-w-[560px] px-8/py-14 给阅读节奏;
          desktop (≥1024) lg:grid 触发 fluid 二段式, art panel 同步 `lg:flex`.
          main 卸 max-w/mx-auto, 改 px clamp / py clamp 让 padding 也 viewport-aware. */}
      <main className="flex flex-col justify-center bg-paper px-5 py-10 md:max-w-[560px] md:mx-auto md:px-8 md:py-14 lg:max-w-none lg:mx-0 lg:px-[clamp(40px,3.5vw,64px)] lg:py-[clamp(40px,4vw,80px)]">
        {children}
      </main>
    </div>
  );
}
