import type { ReactNode } from 'react';

// SIKAO Redesign Wave 1 · hifi .lbl-stack 原子 (border-bottom 输入).
//
// hifi spec: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
//   .lbl-stack (line 435-436) + .inp (line 423-434).
//
// 用于 01 Login / RegisterEmail / RegisterPhone 共享. 跟旧 v1-minimal 卡片
// 输入框 (border-card + paper bg) 不同 — hifi 是 editorial 极简 border-bottom
// only, 焦点用 accent 蓝色底线提示.
//
// 内置可选 rightSlot (RegisterPhone 发码按钮) + hint (说明文字).
//
// AuthShell 路径下其他 6 view (Forgot/Reset/Verify/Bind*/CompleteProfile) 仍走
// 老 卡片 input — 那条路径动它需要 cross-view 视觉一致性 review, 这次不动.

export interface FieldStackProps {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly testId?: string;
  readonly inputMode?: 'numeric' | 'text' | 'email' | 'tel';
  readonly maxLength?: number;
  /** 右侧按钮 / icon, 如 RegisterPhone 的 SendCodeButton. */
  readonly rightSlot?: ReactNode;
  /** 输入框下提示, 如 "邮箱、手机号或用户名" / "发送后 60 秒内有效". */
  readonly hint?: ReactNode;
}

const INPUT_CLASS =
  'w-full bg-transparent border-0 border-b border-line text-ink text-base placeholder:text-ink-4 py-2 outline-none focus:border-accent transition-colors duration-fast ease-motion';

export function FieldStack({
  id,
  label,
  type,
  autoComplete,
  placeholder,
  value,
  onChange,
  testId,
  inputMode,
  maxLength,
  rightSlot,
  hint,
}: FieldStackProps) {
  // a11y (chrome MCP audit 2026-05-13 P1): label/input cross-node 是 W3C 标准,
  // 但 axe-core / chrome MCP scan 不识别 sibling htmlFor 链 → 报 labelCount=0.
  // 加 aria-labelledby 显式指 label id 让 scanner & SR 都能 traverse. 跟
  // <label htmlFor> 并存 — visible label 仍由 <label> 渲, aria-labelledby 是
  // belt-and-suspenders 兜底 (W3C ARIA 1.2 spec 允许 + 推荐双绑).
  const labelId = `${id}-label`;
  return (
    <div className="flex flex-col gap-2">
      <label
        id={labelId}
        htmlFor={id}
        className="font-mono text-tiny tracking-eyebrow uppercase text-ink-3"
      >
        {label}
      </label>
      {rightSlot !== undefined ? (
        <div className="flex items-end gap-2">
          <input
            id={id}
            type={type}
            autoComplete={autoComplete}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            data-testid={testId}
            inputMode={inputMode}
            maxLength={maxLength}
            aria-labelledby={labelId}
            className={`${INPUT_CLASS} flex-1 min-w-0`}
          />
          {rightSlot}
        </div>
      ) : (
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-labelledby={labelId}
          className={INPUT_CLASS}
        />
      )}
      {hint !== undefined ? (
        <div className="text-xs text-ink-3">{hint}</div>
      ) : null}
    </div>
  );
}
