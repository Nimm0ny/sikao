import { useEffect, useRef } from 'react';
import { cn } from '@sikao/shared-utils';
import { useFbSettings, type FbDensity, type FbOptStyle } from '@sikao/domain/xingce/useFbSettings';

// SIKAO Phase 3 P2 (2026-05-11): fb 答题考场态独立 density 偏好 popover.
// SIKAO Phase 3 P3a (2026-05-11): 扩 OptStyleSection (圆形 / 方形 letter).
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md §10 + 本 phase SPEC §2.
//
// Container: anchor popover (类比 components/practice/SettingsPopover.tsx),
// 不用 Modal — 用户改 density 后还要看 layout 变化, focus trap 反而干扰.
// outside pointerdown + Esc 关.
//
// id="fb-settings-popover" 跟 FbTopbar settings IconBtn aria-controls 配套
// (a11y: 屏幕阅读器需要知道 toggle button 控制哪个 dialog).
//
// Dumb by contract:
//   open / onClose 由 caller 控制 (PracticeSession.useFbUiState.settingsOpen),
//   不内部 useState.
//
// Scope:
//   字号留给后续 polish. letter 形状 P3a 完成.

export interface FbSettingsPopoverProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface DensityOption {
  readonly value: FbDensity;
  readonly label: string;
  readonly hint: string;
}

interface OptStyleOption {
  readonly value: FbOptStyle;
  readonly label: string;
}

const DENSITY_OPTIONS: ReadonlyArray<DensityOption> = [
  { value: 'cozy', label: '舒适', hint: '更呼吸' },
  { value: 'compact', label: '紧凑', hint: '省屏' },
];

const OPT_STYLE_OPTIONS: ReadonlyArray<OptStyleOption> = [
  { value: 'circle', label: '圆形' },
  { value: 'square', label: '方形' },
];

export function FbSettingsPopover({ open, onClose }: FbSettingsPopoverProps) {
  const { settings, setDensity, setOptStyle } = useFbSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  // outside pointerdown + Escape 关.
  // 跟 SettingsPopover 41-56 行同款模式.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e: PointerEvent): void => {
      if (containerRef.current?.contains(e.target as Node) === true) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      id="fb-settings-popover"
      role="dialog"
      aria-label="阅读设置"
      className={cn(
        'absolute right-4 md:right-6 top-full mt-2 w-[280px] z-30',
        'rounded-card border border-line bg-surface p-5 shadow-pop',
      )}
      data-testid="fb-settings-popover"
    >
      <DensitySection
        value={settings.density}
        onChange={(v) => setDensity(v)}
      />
      <OptStyleSection
        value={settings.optStyle}
        onChange={(v) => setOptStyle(v)}
      />
    </div>
  );
}

interface DensitySectionProps {
  readonly value: FbDensity;
  readonly onChange: (next: FbDensity) => void;
}

function DensitySection({ value, onChange }: DensitySectionProps) {
  // 段控键盘导航 — ArrowLeft/Right 在 cozy / compact 间切换 + 立即应用.
  // WAI-ARIA radiogroup 模式 (跟 TweaksDrawer ToggleGroup 122-167 行同款).
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const currentIdx = DENSITY_OPTIONS.findIndex((o) => o.value === value);
    if (currentIdx === -1) return;
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIdx = (currentIdx + delta + DENSITY_OPTIONS.length) % DENSITY_OPTIONS.length;
    const next = DENSITY_OPTIONS[nextIdx];
    onChange(next.value);
  };

  return (
    <div>
      <div className="text-tiny font-bold text-ink-3 tracking-loose mb-3">
        阅读密度
      </div>
      <div
        role="radiogroup"
        aria-label="阅读密度"
        className={cn(
          'inline-flex w-full items-stretch border border-line rounded-tiny overflow-hidden',
          'bg-surface',
        )}
      >
        {DENSITY_OPTIONS.map((opt, idx) => {
          const selected = opt.value === value;
          const isFirst = idx === 0;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={opt.label}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(opt.value)}
              onKeyDown={onKeyDown}
              data-testid={`fb-density-${opt.value}`}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'focus-visible:ring-offset-2 focus-visible:z-10 relative',
                !isFirst && 'border-l border-line',
                selected
                  ? 'bg-ink text-white'
                  : 'bg-surface text-ink-3 hover:text-ink hover:bg-surface-alt',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        紧凑省屏; 舒适更呼吸. 仅本场答题生效.
      </p>
    </div>
  );
}

interface OptStyleSectionProps {
  readonly value: FbOptStyle;
  readonly onChange: (next: FbOptStyle) => void;
}

function OptStyleSection({ value, onChange }: OptStyleSectionProps) {
  // 段控键盘导航 — ArrowLeft/Right 在 circle / square 间切换 + 立即应用.
  // 跟 DensitySection 同模式 (WAI-ARIA radiogroup).
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const currentIdx = OPT_STYLE_OPTIONS.findIndex((o) => o.value === value);
    if (currentIdx === -1) return;
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIdx = (currentIdx + delta + OPT_STYLE_OPTIONS.length) % OPT_STYLE_OPTIONS.length;
    const next = OPT_STYLE_OPTIONS[nextIdx];
    onChange(next.value);
  };

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="text-tiny font-bold text-ink-3 tracking-loose mb-3">
        选项形状
      </div>
      <div
        role="radiogroup"
        aria-label="选项形状"
        className={cn(
          'inline-flex w-full items-stretch border border-line rounded-tiny overflow-hidden',
          'bg-surface',
        )}
      >
        {OPT_STYLE_OPTIONS.map((opt, idx) => {
          const selected = opt.value === value;
          const isFirst = idx === 0;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={opt.label}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(opt.value)}
              onKeyDown={onKeyDown}
              data-testid={`fb-opt-style-${opt.value}`}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'focus-visible:ring-offset-2 focus-visible:z-10 relative',
                !isFirst && 'border-l border-line',
                selected
                  ? 'bg-ink text-white'
                  : 'bg-surface text-ink-3 hover:text-ink hover:bg-surface-alt',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        圆形更柔和; 方形更工具感. 仅本场答题生效.
      </p>
    </div>
  );
}
