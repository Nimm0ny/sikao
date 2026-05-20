import { cn } from '@sikao/shared-utils';
import { Tooltip } from '@sikao/ui/ui';
// R2.4 (2026-05-13): PracticeViewMode 类型 SSOT 上提到 @sikao/domain/xingce/viewMode.
import type { PracticeViewMode } from '@sikao/domain/xingce/viewMode';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// Phase 3.4 fenbi-merge — header 内的 deck/scroll 视图切换. scroll 模式
// 实际渲染逻辑在 Phase 3.3 (Wave D) 落地, 本组件先提供 UI 占位 + 偏好
// 联通: scroll 选项 disabled + tooltip "即将上线", 让用户感知该选项存在.
//
// 偏好 read/write 由 caller 接 useViewModePreference (lib/viewMode.ts),
// 本组件只是 dumb 受控 toggle.

// PracticeViewMode SSOT 在 @sikao/domain/xingce/viewMode (R2.4). 这里 re-export
// 保持 backward-compat 给 apps/web 老 import 路径.
export type { PracticeViewMode };

export interface ViewModeToggleProps {
  readonly value: PracticeViewMode;
  readonly onChange: (mode: PracticeViewMode) => void;
  /** scroll 模式默认 disabled, 等 Phase 3.3 落地后接通后置 false. */
  readonly scrollDisabled?: boolean;
  readonly className?: string;
}

interface OptionConfig {
  readonly mode: PracticeViewMode;
  readonly label: string;
}

const OPTIONS: readonly OptionConfig[] = [
  { mode: 'deck', label: '单题' },
  { mode: 'scroll', label: '滚动' },
];

export function ViewModeToggle({
  value,
  onChange,
  scrollDisabled = true,
  className,
}: ViewModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="视图模式"
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-tiny border border-line bg-surface-alt',
        className,
      )}
      data-testid="view-mode-toggle"
    >
      {OPTIONS.map(({ mode, label }) => {
        const active = value === mode;
        const disabled = mode === 'scroll' && scrollDisabled;
        return (
        <Tooltip key={mode} label={disabled ? `${label}${PRACTICE_COPY.viewModeComingSoon}` : `${label}模式`}>
            <button
              type="button"
              onClick={() => !disabled && onChange(mode)}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`${label}模式${disabled ? ' · 即将上线' : ''}`}
              className={cn(
                'inline-flex h-7 w-8 items-center justify-center rounded-tiny text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active
                  ? 'bg-surface text-ink font-semibold shadow-card'
                  : 'text-ink-3 hover:text-ink',
                disabled && 'opacity-45 cursor-not-allowed hover:text-ink-3',
              )}
              data-testid={`view-mode-${mode}`}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {mode === 'deck' ? (
                  <>
                    <rect x="4" y="5" width="16" height="6" rx="1" />
                    <path d="M4 14h16M4 18h16" />
                  </>
                ) : (
                  <path d="M4 6h16M4 10h16M4 14h16M4 18h10" />
                )}
              </svg>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
