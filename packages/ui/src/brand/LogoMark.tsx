import type { CSSProperties } from 'react';

/**
 * LogoMark — 思考品牌方形标识 (Mark only).
 *
 * 设计 SSOT: `element/preview/logo.html` (Mark / Reverse on ink / Favicon 三档).
 * 使用规范: `docs/design/style-guide.md §1.4 品牌 Logo`.
 *
 * 结构: 圆角方块底 + 白色 "田" 字 (6 stroke line) + 一个白色圆点
 * (在 "田" 下方位置, 抽象 "心" 字底 —— "思考" 的 "思" 拆字).
 *
 * 不要再加两条心弧 wave —— 那是 phase 5 自创的 abstract heart, 已被否决.
 * 不要 hardcode 字符 "思" / "公" 在色块里凑合 —— 那是 phase 5 残留的 logo
 * placeholder, 全部走本组件.
 *
 * Variants:
 *   - on-light (default): 黑底 + 白线   —— marketing nav / footer / 任何浅底
 *   - on-dark            : 白底 + 黑线   —— 深色 sidebar / hero card 等深底
 *
 * Sizes (推荐 px): 24 (footer) / 30 (marketing nav) / 32 (sidebar) / 64 (hero).
 *
 * 不在这里支持 wordmark (mark + 思考字 + Sīkǎo 拼音). Wordmark 单独组件出.
 */

type Variant = 'on-light' | 'on-dark';

interface Props {
  readonly size?: number;
  readonly variant?: Variant;
  readonly className?: string;
  readonly style?: CSSProperties;
}

// Logo brand color frozen per CLAUDE.md §3.7 + docs/design/style-guide.md §1.4 —
// 颜色调整必须走 ≥3 方案 + 双轮拍板; PR5a 不动颜色值, 仅保留 hex 字面量.
const PALETTE: Record<Variant, { bg: string; fg: string }> = {
  'on-light': { bg: '#0b1120', fg: '#ffffff' }, // hardcode-allow: logo brand color, see CLAUDE.md §3.7
  'on-dark': { bg: '#ffffff', fg: '#0b1120' },  // hardcode-allow: logo brand color, see CLAUDE.md §3.7
};

export function LogoMark({ size = 32, variant = 'on-light', className, style }: Props) {
  const { bg, fg } = PALETTE[variant];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="10" fill={bg} />
      <g stroke={fg} strokeWidth="1.8" strokeLinecap="round">
        <line x1="11" y1="13" x2="29" y2="13" />
        <line x1="11" y1="22" x2="29" y2="22" />
        <line x1="11" y1="13" x2="11" y2="27" />
        <line x1="20" y1="13" x2="20" y2="27" />
        <line x1="29" y1="13" x2="29" y2="27" />
        <line x1="11" y1="27" x2="29" y2="27" />
      </g>
      <circle cx="20" cy="34" r="2.2" fill={fg} />
    </svg>
  );
}
