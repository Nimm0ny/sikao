import { useEffect, useRef, useState } from 'react';
import { cn } from '@sikao/shared-utils';
import { ToolSettingsIcon, ToolThemeIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import {
  usePracticeFontSize,
  type PracticeFontSize,
} from '@sikao/domain/xingce/practiceFontSize';
import { useThemeStore } from '@/styles/useThemeStore';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// Phase 3.5 + 3.6 fenbi-merge — header 设置 popover (字号 + 夜间).
// 夜间 D3: 仅考场态生效, 离开考场态自动复位 light (useApplyExamTheme).
//
// 自实现 popover (无 ui 库) — anchor button + 绝对定位 panel + outside
// click 关闭. 不用 Modal 因为不需要 backdrop, 不抢焦点 (用户切字号后还要
// 看题干变化, focus trap 反而干扰).

const FONT_OPTIONS: ReadonlyArray<{
  readonly value: PracticeFontSize;
  readonly hint: string;
}> = [
  { value: 'sm', hint: '小' },
  { value: 'md', hint: '中' },
  { value: 'lg', hint: '大' },
];

const FONT_ICON_DOT_RADIUS: Record<PracticeFontSize, number> = {
  sm: 1.5,
  md: 2.2,
  lg: 3,
};

export function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fontSize = usePracticeFontSize();
  const examTheme = useThemeStore((s) => s.examTheme);
  const toggleExamTheme = useThemeStore((s) => s.toggleExamTheme);

  // Outside click + Escape 关闭
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e: PointerEvent): void => {
      if (containerRef.current?.contains(e.target as Node) === true) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Tooltip label="设置">
        <button
          type="button"
          aria-label="设置"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-tiny border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            open
              ? 'border-line bg-surface-alt text-ink'
              : 'border-transparent text-ink-3 hover:bg-surface-alt hover:text-ink',
          )}
          data-testid="session-header-settings"
        >
          <ToolSettingsIcon size={20} />
        </button>
      </Tooltip>
      {open ? (
        <div
          role="dialog"
          aria-label="答题设置"
          className="absolute right-0 top-full mt-2 w-64 rounded-card border border-line bg-surface p-4 shadow-pop z-30"
          data-testid="settings-popover"
        >
          <FontSizeSection
            value={fontSize.value}
            onChange={fontSize.setValue}
          />
          <div className="mt-4 pt-4 border-t border-line">
            <DarkModeRow theme={examTheme} onToggle={toggleExamTheme} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface FontSizeSectionProps {
  readonly value: PracticeFontSize;
  readonly onChange: (next: PracticeFontSize) => void;
}

function FontSizeSection({ value, onChange }: FontSizeSectionProps) {
  return (
    <div>
      <div className="text-tiny font-bold text-ink-3 tracking-loose mb-2">
        阅读字号
      </div>
      <div
        role="group"
        aria-label="阅读字号"
        className="grid grid-cols-3 gap-2"
      >
        {FONT_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Tooltip key={opt.value} label={`${opt.hint}号字`}>
              <button
                type="button"
                onClick={() => onChange(opt.value)}
                aria-pressed={active}
                aria-label={`${opt.hint}号字`}
                className={cn(
                  'flex h-12 items-center justify-center rounded-tiny border transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active
                    ? 'border-ink bg-surface-alt text-ink'
                    : 'border-line bg-surface text-ink-3 hover:border-line-3 hover:text-ink',
                )}
                data-testid={`font-size-${opt.value}`}
              >
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 19h14" />
                  <path d="M9 19 14 5l5 14" />
                  <path d="M11 14h5" />
                  <circle
                    cx="6.5"
                    cy="12"
                    r={FONT_ICON_DOT_RADIUS[opt.value]}
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </button>
            </Tooltip>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        改变题干 / 选项 / {PRACTICE_COPY.settingsMaterialFont}
      </p>
    </div>
  );
}

interface DarkModeRowProps {
  readonly theme: 'light' | 'dark';
  readonly onToggle: () => void;
}

function DarkModeRow({ theme, onToggle }: DarkModeRowProps) {
  const isDark = theme === 'dark';
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-tiny font-bold text-ink-3 tracking-loose">
          夜间模式
        </div>
        <p className="mt-1 text-xs text-ink-3">仅答题 / 报告 / {PRACTICE_COPY.settingsExamOnly}</p>
      </div>
      <Tooltip label={isDark ? '切到日间' : '切到夜间'}>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={isDark}
          aria-label={isDark ? '切到日间' : '切到夜间'}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-tiny border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            isDark
              ? 'border-ink bg-ink text-white hover:opacity-90'
              : 'border-line bg-surface text-ink-3 hover:border-line-3 hover:text-ink',
          )}
          data-testid="settings-toggle-dark"
        >
          <ToolThemeIcon size={16} />
        </button>
      </Tooltip>
    </div>
  );
}
