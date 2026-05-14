import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Frontend Style Guide v1 (PR3) primitive — editorial radio.
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .check-row (line ~414-415).
//   .check-row input[type="checkbox"], .check-row input[type="radio"] {
//     accent-color: var(--accent-1);
//   }
// 跟 Checkbox 同套规范, 实现共享样式 + accent-color tint, 接口仅多 `name` (radio group).
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 无 store / fetch; onChange 由 caller 处理.
// onChange 签名是 `() => void` (跟 checkbox 的 `(checked) => void` 不同) — radio 是 group
// 排他选择, 通常 caller 不关心是哪个 input 触发, 只关心 value.

export interface RadioProps {
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly name: string;
  readonly value: string;
  readonly label: ReactNode;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}

const BASE =
  'inline-flex items-center gap-2 py-1 text-small text-ink-2 ' +
  'cursor-pointer select-none ' +
  'has-[input:disabled]:opacity-50 has-[input:disabled]:cursor-not-allowed';

export function Radio({
  checked,
  onChange,
  name,
  value,
  label,
  disabled = false,
  id,
  className,
}: RadioProps): ReactNode {
  return (
    <label className={cn(BASE, className)} htmlFor={id}>
      {/* a11y: nested <label> 包 <input> + sibling <span> label 是 W3C 合法 pattern.
          plugin 只看直接 textContent, 不识别 sibling <span>, 行级 escape. */}
      {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange()}
        className="accent-[var(--accent-1)] w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
      />
      <span>{label}</span>
    </label>
  );
}
