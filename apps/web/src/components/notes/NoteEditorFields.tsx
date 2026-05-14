/**
 * SIKAO Wave 4 Phase 2D · NoteEditor primitive field 原子.
 *
 * 拆分自 NoteEditor.tsx 让主 view 保持 ≤ 500 行 (frontend/CLAUDE.md §3.5).
 * 3 个 dumb 原子: FieldText / FieldTextarea / FieldSelect. 无 store / 无 API,
 * 只接 props + 抛 onChange. NoteEditor 内 EditorMetadata / EditorBodyField
 * 引用. 视觉 / 行为 / className 跟原版字符级一致.
 */
import type { ReactElement } from 'react';

interface FieldTextProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly onChange: (next: string) => void;
  readonly className?: string;
  readonly testId?: string;
}

export function FieldText({
  label,
  value,
  placeholder,
  onChange,
  className,
  testId,
}: FieldTextProps): ReactElement {
  return (
    <label className={`flex flex-col gap-2 ${className ?? ''}`}>
      <span className="font-mono text-tiny tracking-wide uppercase text-ink-4">
        {label}
      </span>
      {/* a11y: nested <label> wraps <span> label + <input>; plugin 不识别 sibling
          text 当 label, 行级 escape. */}
      {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="px-3 py-2 bg-transparent border border-line rounded-tiny font-sans text-sm text-ink placeholder:text-ink-4 focus-visible:outline-none focus-visible:border-ink"
      />
    </label>
  );
}

interface FieldTextareaProps extends FieldTextProps {
  readonly rows?: number;
}

export function FieldTextarea({
  label,
  value,
  placeholder,
  onChange,
  rows = 6,
  className,
  testId,
}: FieldTextareaProps): ReactElement {
  return (
    <label className={`flex flex-col gap-2 ${className ?? ''}`}>
      <span className="font-mono text-tiny tracking-wide uppercase text-ink-4">
        {label}
      </span>
      {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        data-testid={testId}
        className="px-3 py-2 bg-transparent border border-line rounded-tiny font-serif text-sm leading-relaxed text-ink placeholder:text-ink-4 focus-visible:outline-none focus-visible:border-ink resize-y"
      />
    </label>
  );
}

interface FieldSelectProps {
  readonly label: string;
  readonly value: string;
  readonly options: ReadonlyArray<{ value: string; label: string }>;
  readonly onChange: (next: string) => void;
  readonly testId?: string;
}

export function FieldSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: FieldSelectProps): ReactElement {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-tiny tracking-wide uppercase text-ink-4">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="px-3 py-2 bg-transparent border border-line rounded-tiny font-sans text-sm text-ink focus-visible:outline-none focus-visible:border-ink"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
