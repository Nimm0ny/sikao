import { useMemo } from 'react';
import { cn } from '@sikao/shared-utils';
import { StatusDoneIcon, StatusWrongIcon } from '@sikao/ui/icons';

// SIKAO Phase 3 P3b (2026-05-11): fb 行测考场态判断题 (TF) 渲染.
//
// 设计 SSOT: design/design_handoff_xingce_exam/SPEC.md §4.2 + §10
// (kbd 快捷键 T/F).
//
// Layout (SPEC §4.2):
//   - 2 列 pill grid (gap-4), 每 pill 高 64px
//   - 内部 grid [24px icon | 中文 label 18 Serif | 右侧 T/F mono hint]
//   - 选中: border-exam-accent + bg-exam-accent-50
//   - 未选: border-line + hover:bg-paper-3
//
// 状态:
//   - unanswered: 默认 border-line
//   - selected:   border-exam-accent + bg-exam-accent-50
//   - disabled:   opacity-60 + cursor-not-allowed
//
// 行为 (镜像 FbOpts single):
//   - selected=['T'] / ['F'] / []
//   - 点击 fires onChange(qid, [key])
//   - 已选不取消 (跟 single_choice 一致)
//
// 键盘 (本地 onKeyDown — P6 全局 dispatcher 之前的过渡):
//   - focus 在 T pill: 按 T → click T (实际 noop 如果已选); 按 F → click F
//   - focus 在 F pill: 按 T → click T; 按 F → click F (noop 如果已选)
//
// Dumb by contract: 不读 store; selected 由 caller 传入.

export interface FbTFProps {
  readonly questionId: string;
  readonly selected: readonly string[];
  readonly onChange: (questionId: string, optionKeys: string[]) => void;
  readonly disabled?: boolean;
}

interface TFOption {
  readonly key: 'T' | 'F';
  readonly label: string;
  readonly hint: string;
  readonly icon: 'done' | 'wrong';
}

const OPTS: readonly TFOption[] = [
  { key: 'T', label: '正确', hint: 'T', icon: 'done' },
  { key: 'F', label: '错误', hint: 'F', icon: 'wrong' },
] as const;

export function FbTF({ questionId, selected, onChange, disabled = false }: FbTFProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const fire = (optionKey: 'T' | 'F'): void => {
    if (disabled) return;
    onChange(questionId, [optionKey]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    const key = event.key.toUpperCase();
    if (key === 'T' || key === 'F') {
      event.preventDefault();
      fire(key);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={`第 ${questionId} 题判断选项`}
      className="grid grid-cols-2 gap-4"
      data-testid={`fb-tf-${questionId}`}
    >
      {OPTS.map((opt) => {
        const isSelected = selectedSet.has(opt.key);
        const IconCmp = opt.icon === 'done' ? StatusDoneIcon : StatusWrongIcon;
        return (
          // svg-only-allow: 判断题选项 pill 是 content (icon + 中文 label), 不是 tool button
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`判断 ${opt.label} (快捷键 ${opt.hint})`}
            disabled={disabled}
            onClick={() => fire(opt.key)}
            onKeyDown={handleKeyDown}
            data-state={isSelected ? 'selected' : 'unanswered'}
            data-testid={`fb-tf-opt-${opt.key}`}
            className={cn(
              'h-16 grid grid-cols-[24px_1fr_auto] items-center gap-3 px-4',
              'border rounded-tiny text-left transition-colors duration-fast ease-motion',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              isSelected
                ? 'border-exam-accent bg-exam-accent-50'
                : 'border-line hover:bg-paper-3',
            )}
          >
            <span aria-hidden="true" className="inline-flex items-center justify-center text-ink">
              <IconCmp size={24} />
            </span>
            <span className="font-serif text-lg leading-relaxed text-ink">{opt.label}</span>
            <span
              aria-hidden="true"
              className="font-mono text-sm text-ink-3 tabular-nums"
            >
              {opt.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
