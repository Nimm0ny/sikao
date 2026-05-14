import type { ChangeEvent, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Frontend Style Guide v1 (PR3) primitive — editorial checkbox.
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .check-row (line ~414-415).
//   - row: padding 4px 0 / gap 8px / font-size 13px / color var(--ink-2)
//   - input: accent-color: var(--accent-1)  ← 浏览器 native check tint 走规范蓝
//
// 实现选择: 原生 <input type="checkbox"> + 包 <label>. 不用 portal / custom SVG.
// 走 native input 默认 a11y 行为 (Space / 键盘 focus / 屏幕阅读器 state).
// accent-color 是 CSS Level 4 widget tint, 现代浏览器 (Chrome 93+ / Safari 15.4+ / Firefox 92+) 全支持.
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 无 store / fetch; onChange 由 caller 处理.

export interface CheckboxProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: ReactNode;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly className?: string;
}

// `accent-[var(--accent-1)]` 走 Tailwind arbitrary value 绑 token, 命中 accent-color
// CSS property. 走 token = 跟随 dark theme 自动切换 (深色态琥珀 #C68A3E).
const BASE =
  'inline-flex items-center gap-2 py-1 text-small text-ink-2 ' +
  'cursor-pointer select-none ' +
  'has-[input:disabled]:opacity-50 has-[input:disabled]:cursor-not-allowed';

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  name,
  className,
}: CheckboxProps): ReactNode {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label className={cn(BASE, className)} htmlFor={id}>
      {/* a11y: nested <label> 包 <input> + sibling <span> label 是 W3C 合法 pattern.
          plugin 只看直接 textContent, 不识别 sibling <span>, 行级 escape. */}
      {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        // accent-color 走规范 accent-1; arbitrary value 因为 Tailwind 默认无 accent-color utility
        className="accent-[var(--accent-1)] w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
      />
      <span>{label}</span>
    </label>
  );
}
