import type { ReactNode } from 'react';
import { LogoMark } from '@sikao/ui/brand/LogoMark';

/**
 * LoginArtPanel — SIKAO Redesign Wave 1 · 01 Login art panel.
 *
 * hifi spec: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
 *   line 1738-1791 (artboard) + line 1102-1162 (CSS).
 *
 * 二段式登录 layout 的左侧 editorial 面板. bg-ink + paper 文字, 配 3×3 grid +
 * 中心 accent 点 + 横纵 axes 装饰构成"取景框", quote 主标语 + EST/VOL/AGENT
 * mono meta. 灵感: 静读、克制、像图书馆隔壁桌的同学.
 *
 * P2 Reading Spread 改造 (2026-05-12 lhr 拍板):
 *   - quote / window / meta 全用 clamp() viewport-aware 字号 / sizes
 *     (1024 紧凑, 1920 大画板, 4K editorial 杂志感, 无空虚不散架)
 *   - quote max-width 用绝对值 clamp(360,44vw,880) 而非 ch (CJK 1em/字, ch 不适用),
 *     保证 "从刷题变成思考。" 8 字任意 viewport 1 行不换行
 *   - art-window absolute 相对 aside, right: clamp(6%,7%,9%) — 大 viewport 上
 *     不会离 form 列过远, 跟 hifi 假设位置匹配
 *   - 动画 (入场 fade-up + ambient breathe + window 入场 scale + 中心格 pulse-ring +
 *     轴线脉动 + brand 慢呼吸 + quote 句尾 cursor blink) 走 `.auth-anim-up` +
 *     局部 keyframes 引用 (auth-window-in / auth-breathe-cell / etc), 见 index.css.
 *     Reduce-motion media query 在 index.css 关 keyframes 保留 transition.
 *   - LogoMark 走 brand SSOT component (variant=on-dark, paper bg + ink stroke,
 *     不 hardcode "思" 字).
 *
 * Animation cascade fix: caller Login.tsx 必须在 animationend 事件后
 * removeClass('auth-anim-up') 让 :hover transform 不被 animation-fill 卡住.
 */

interface Props {
  readonly highlight?: string;
  readonly strike?: string;
  readonly footer?: ReactNode;
}

export function LoginArtPanel({
  highlight = '思考',
  strike = '刷题',
  footer = 'A QUIET COMPANION FOR CIVIL SERVICE EXAM · 国考 · 省考 · 选调',
}: Props) {
  return (
    <aside
      className="login-art-panel relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink text-paper"
      data-testid="login-art-panel"
      aria-label="思考品牌介绍"
      style={{ padding: 'clamp(40px, 4vw, 80px)' }}
    >
      {/* radial accent glow 左下 — 替代 hifi .login-art::after */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-0"
        style={{
          left: '-10%',
          bottom: '-20%',
          width: '60%',
          aspectRatio: '1',
          background:
            'radial-gradient(circle, var(--accent-1), transparent 65%)',
          opacity: 0.18,
        }}
      />

      {/* brand 头 — LogoMark SSOT (田字 6 stroke + 心字底圆点) + serif SIKAO 文字 */}
      <div
        className="auth-anim-up relative z-10 inline-flex items-center gap-3 font-serif font-semibold tracking-tight"
        style={{ fontSize: 'clamp(18px, 1.4vw, 28px)' }}
      >
        <LogoMark
          size={32}
          variant="on-dark"
          style={{
            width: '1.4em',
            height: '1.4em',
            flexShrink: 0,
            display: 'block',
            animation: 'auth-brand-pulse 6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
            transformOrigin: 'center',
          }}
        />
        <span>SIKAO</span>
      </div>

      {/* art-window 装饰 — 3×3 grid + axes + tick — 居右垂直居中, 入场 scale+fade */}
      <div
        aria-hidden="true"
        className="art-window pointer-events-none absolute z-0"
        style={{
          right: 'clamp(6%, 7%, 9%)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'clamp(180px, 14vw, 380px)',
          height: 'clamp(180px, 14vw, 380px)',
          opacity: 0,
          animation: 'auth-window-in 1100ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both',
        }}
      >
        {/* axes (横/纵 1px 线, 出框 -24px) — ambient 脉动 */}
        <div className="absolute pointer-events-none" style={{ inset: '-24px' }}>
          <span
            className="absolute top-0 bottom-0 left-1/2 w-px"
            style={{
              background: 'color-mix(in oklch, var(--paper-1), transparent 80%)',
              animation: 'auth-breathe-line 4500ms cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
            }}
          />
          <span
            className="absolute left-0 right-0 top-1/2 h-px"
            style={{
              background: 'color-mix(in oklch, var(--paper-1), transparent 80%)',
              animation: 'auth-breathe-line 4500ms cubic-bezier(0.45, 0.05, 0.55, 0.95) -1800ms infinite',
            }}
          />
        </div>
        {/* 3×3 grid, 9 格逐个 fade-in stagger, 中心格 ambient + pulse-ring */}
        <div
          className="art-window-grid absolute inset-0 grid grid-cols-3 grid-rows-3"
          style={{ border: '1px solid color-mix(in oklch, var(--paper-1), transparent 68%)' }}
        >
          {Array.from({ length: 9 }).map((_, i) => {
            const isCenter = i === 4;
            const col = i % 3;
            const row = Math.floor(i / 3);
            const isLastCol = col === 2;
            const isLastRow = row === 2;
            const baseDelay = 600 + i * 60;
            const centerDelay = 1000;
            return (
              <span
                key={i}
                style={{
                  borderRight: isLastCol
                    ? 'none'
                    : '1px solid color-mix(in oklch, var(--paper-1), transparent 84%)',
                  borderBottom: isLastRow
                    ? 'none'
                    : '1px solid color-mix(in oklch, var(--paper-1), transparent 84%)',
                  background: isCenter ? 'var(--accent-1)' : 'transparent',
                  opacity: 0,
                  borderRadius: isCenter ? '1px' : '0',
                  transformOrigin: 'center',
                  animation: isCenter
                    ? `auth-fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) ${centerDelay}ms both, auth-breathe-cell 3600ms cubic-bezier(0.45, 0.05, 0.55, 0.95) ${centerDelay + 600}ms infinite, auth-pulse-ring 3200ms cubic-bezier(0.45, 0.05, 0.55, 0.95) ${centerDelay + 800}ms infinite`
                    : `auth-fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) ${baseDelay}ms both`,
                }}
              />
            );
          })}
        </div>
        {/* tick 编号 N° 0426 */}
        <div
          className="absolute font-mono tracking-widest text-left"
          style={{
            right: '-3.5em',
            top: '-0.3em',
            fontSize: 'clamp(10px, 0.7vw, 14px)',
            lineHeight: 1.4,
            color: 'color-mix(in oklch, var(--paper-1), transparent 45%)',
          }}
        >
          N&deg;<br />0426
        </div>
      </div>

      {/* 主标语 quote — 中段 (mt-auto/mb-auto 推到中间靠下) + 句尾 cursor blink */}
      <div
        className="auth-anim-up d-2 relative z-10 font-serif font-normal"
        style={{
          fontSize: 'clamp(40px, 5vw, 96px)',
          lineHeight: 1.12,
          letterSpacing: '-0.018em',
          color: 'var(--paper-1)',
          maxWidth: 'clamp(360px, 44vw, 880px)',
          margin: 'auto 0',
          textWrap: 'pretty',
        }}
      >
        让备考
        <br />
        从
        <s
          className="line-through font-normal"
          style={{
            textDecorationThickness: '0.06em',
            color: 'color-mix(in oklch, var(--paper-1), transparent 55%)',
          }}
        >
          {strike}
        </s>
        变成
        <span className="font-serif font-medium text-accent">{highlight}</span>
        。
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '0.08em',
            height: '0.9em',
            background: 'color-mix(in oklch, var(--paper-1), transparent 15%)',
            marginLeft: '0.06em',
            verticalAlign: '-0.1em',
            animation: 'auth-blink-cursor 1800ms cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />
      </div>

      {/* meta + foot 区 */}
      <div
        className="auth-anim-up d-3 relative z-10 flex flex-col"
        style={{ gap: 'clamp(16px, 1.5vw, 32px)' }}
      >
        <div
          className="flex font-mono tracking-widest"
          style={{
            gap: 'clamp(24px, 2vw, 48px)',
            paddingTop: 'clamp(16px, 1.3vw, 24px)',
            fontSize: 'clamp(10px, 0.6vw, 13px)',
            color: 'color-mix(in oklch, var(--paper-1), transparent 45%)',
            borderTop: '1px solid color-mix(in oklch, var(--paper-1), transparent 84%)',
            letterSpacing: '0.14em',
          }}
        >
          <MetaItem k="EST." v="2026" />
          <MetaItem k="VOL." v="III" />
          <MetaItem k="AGENT" v="SIKAO" />
        </div>
        <div
          className="font-mono tracking-widest uppercase"
          style={{
            fontSize: 'clamp(10px, 0.65vw, 14px)',
            color: 'color-mix(in oklch, var(--paper-1), transparent 55%)',
            letterSpacing: '0.14em',
          }}
        >
          {footer}
        </div>
      </div>
    </aside>
  );
}

interface MetaItemProps {
  readonly k: string;
  readonly v: string;
}

function MetaItem({ k, v }: MetaItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ color: 'color-mix(in oklch, var(--paper-1), transparent 60%)' }}>{k}</span>
      <span
        style={{
          fontSize: 'clamp(11px, 0.7vw, 15px)',
          color: 'color-mix(in oklch, var(--paper-1), transparent 15%)',
          letterSpacing: '0.08em',
        }}
      >
        {v}
      </span>
    </div>
  );
}
