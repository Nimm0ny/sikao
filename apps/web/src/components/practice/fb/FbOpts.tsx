import { useMemo } from 'react';
import { cn } from '@sikao/shared-utils';
import type { QuestionOption } from '@sikao/api-client/types/api';

// SIKAO Phase 3 (2026-05-09): 4 选项, 圆形 letter A B C D.
// SIKAO Phase 3 P3a (2026-05-11): 扩 multi 分支 + letter 形状切换 + at-least-2 hint.
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md + 本 phase SPEC §4.1 / §11.
//
// 行为分支 (questionKind):
//   - single_choice (默认): role="radiogroup" + role="radio", 已选不取消.
//   - multiple_choice: role="group" + role="checkbox", 已选取消, 未选追加,
//     onChange 抛 sorted array (按 options display order 排序, 跟
//     MultipleChoiceRenderer:42 模式一致).
//
// 状态:
//   - unanswered: rule-strong border + ink-2 text
//   - selected:   ink bg + paper text (single 显字母; multi 显 ✓ SVG)
//   - locked:     已锁定 (提交后/复盘) — 视觉灰. Phase 3 不新增复盘锁定流程.
//
// Letter 形状切换 (Phase 3 P3a):
//   走 <html data-opt-style="circle|square"> + CSS variable `--letter-radius`
//   (tokens.css). letter span 加 style={{ borderRadius: 'var(--letter-radius)' }}
//   响应全局切换. 单元测试也 mirror 一份 data-style attr 方便断言.
//
// Multi at-least-2 hint (Phase 3 P3a SPEC §11 第 6 条):
//   selected.length === 1 时容器底部 p data-testid="fb-opts-multi-hint" +
//   role="status" + aria-live="polite" 渲染 "多选题, 请至少选 2 项".
//   交卷前 block 校验在 PracticeSession.handleSubmit (这里只是软提示).
//
// Dumb by contract: 不读 store; selected / questionKind 由 caller 传入.

export interface FbOptsProps {
  readonly questionId: string;
  readonly options: readonly QuestionOption[];
  readonly selected: readonly string[];
  readonly disabled?: boolean;
  /** Backend questionKind. 'multiple_choice' → multi 分支; 其他 → single. */
  readonly questionKind?: string;
  readonly onChange: (questionId: string, optionKeys: string[]) => void;
}

export function FbOpts({
  questionId,
  options,
  selected,
  disabled = false,
  questionKind,
  onChange,
}: FbOptsProps) {
  const isMulti = questionKind === 'multiple_choice';
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const handleClick = (optionKey: string): void => {
    if (disabled) return;
    if (!isMulti) {
      // single 分支: 已选不取消 (跟当前行为一致, 防误改).
      onChange(questionId, [optionKey]);
      return;
    }
    // multi 分支: toggle. 已选取消, 未选追加. 按 options display order 排序.
    const next = new Set(selectedSet);
    if (next.has(optionKey)) next.delete(optionKey);
    else next.add(optionKey);
    const orderedKeys = options.map((o) => o.key).filter((k) => next.has(k));
    onChange(questionId, orderedKeys);
  };

  return (
    <div
      role={isMulti ? 'group' : 'radiogroup'}
      aria-label={`第 ${questionId} 题选项`}
      data-qtype={isMulti ? 'multi' : 'single'}
      className="flex flex-col gap-2"
      data-testid={`fb-opts-${questionId}`}
    >
      {options.map((opt) => {
        const isSelected = selectedSet.has(opt.key);
        return (
          <FbOpt
            key={opt.key}
            optionKey={opt.key}
            text={opt.text ?? ''}
            selected={isSelected}
            disabled={disabled}
            isMulti={isMulti}
            onClick={() => handleClick(opt.key)}
          />
        );
      })}
      {isMulti && selected.length === 1 ? (
        <p
          data-testid="fb-opts-multi-hint"
          role="status"
          aria-live="polite"
          className="text-tiny tracking-eyebrow text-ink-3 mt-3"
        >
          多选题, 请至少选 2 项
        </p>
      ) : null}
    </div>
  );
}

interface FbOptProps {
  readonly optionKey: string;
  readonly text: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly isMulti: boolean;
  readonly onClick: () => void;
}

function FbOpt({ optionKey, text, selected, disabled, isMulti, onClick }: FbOptProps) {
  return (
    // svg-only-allow: 题目选项 radio/checkbox 是 content (letter A/B/C/D + 题文), 不是 tool button
    <button
      type="button"
      role={isMulti ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-label={`选项 ${optionKey}: ${text}`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid grid-cols-[28px_1fr] items-baseline gap-4 px-4 py-3',
        'border rounded-tiny text-left transition-colors duration-fast ease-motion',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        selected
          ? 'bg-paper-3 border-ink'
          : 'bg-transparent border-transparent hover:bg-paper-3',
      )}
      data-state={selected ? 'selected' : 'unanswered'}
      data-testid={`fb-opt-${optionKey}`}
    >
      <span
        aria-hidden="true"
        data-letter
        className={cn(
          'self-center inline-flex w-7 h-7 items-center justify-center border',
          'font-mono text-sm font-medium tabular-nums',
          'transition-colors duration-fast ease-motion',
          selected
            ? 'bg-ink border-ink text-white'
            : 'bg-transparent border-line-3 text-ink-3',
        )}
        style={{ borderRadius: 'var(--letter-radius, 9999px)' }}
      >
        {isMulti && selected ? (
          // svg-only-allow: multi letter check 是 content (替代字母 letter), 不是 tool button
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 8.5l3 3 7-7" />
          </svg>
        ) : (
          optionKey
        )}
      </span>
      <span className="font-serif text-base leading-relaxed text-ink">{text}</span>
    </button>
  );
}
