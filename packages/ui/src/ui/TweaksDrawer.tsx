import { useId } from 'react';
import { SidePanel } from '@sikao/ui/ui/SidePanel';
import { Stamp } from '@sikao/ui/ui/Stamp';
import {
  useTweaks,
  type TweakDensity,
  type TweakNav,
  type TweakOption,
  type TweakReading,
  type TweakState,
  type TweakTheme,
} from '@sikao/shared-utils/hooks/useTweaks';
import { cn } from '@sikao/shared-utils';

// SIKAO Phase 1' (2026-05-09): 全局阅读偏好 drawer.
//
// 设计 SSOT: `design/SIKAO/extracted/tweaks-protocol.md` + `handoff/CLAUDE.md`
// §「Tweak 协议」. 5 段 toggle group 控制 theme / density / reading / nav /
// option, 数据流走 useTweaks hook.
//
// Container: 复用 SidePanel (右侧滑入), close 按钮 / Esc / backdrop click
// 全部交给 SidePanel. drawer 自身只关心 toggle group 内容.
//
// Dumb by contract: open / onClose 由 caller 控制 (类似 Modal 模式), 不内
// 部 useState. 让 trigger 按钮 / 路由级守卫 都能触发同一 drawer 实例.

export interface TweaksDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function TweaksDrawer({ open, onClose }: TweaksDrawerProps) {
  const { state, setTweak, reset } = useTweaks();
  return (
    <SidePanel open={open} onClose={onClose} title="阅读偏好">
      <div className="px-7 py-6 space-y-7">
        <Stamp>SIKAO · Tweaks</Stamp>
        <ToggleGroup<TweakTheme>
          legend="主题"
          hint="纸读默认; 素白冷感; 夜读暖金."
          value={state.theme}
          onChange={(v) => setTweak('theme', v)}
          options={THEME_OPTIONS}
        />
        <ToggleGroup<TweakDensity>
          legend="密度"
          hint="紧凑省屏; 舒适更呼吸."
          value={state.density}
          onChange={(v) => setTweak('density', v)}
          options={DENSITY_OPTIONS}
        />
        <ToggleGroup<TweakReading>
          legend="阅读字号"
          hint="标准 15px / 大字 17px / 特大 19px (题干 + 选项 + 材料)."
          value={state.reading}
          onChange={(v) => setTweak('reading', v)}
          options={READING_OPTIONS}
        />
        <ToggleGroup<TweakNav>
          legend="导航位置"
          hint="左侧固定 sidebar 或顶部水平条 (响应式)."
          value={state.nav}
          onChange={(v) => setTweak('nav', v)}
          options={NAV_OPTIONS}
        />
        <ToggleGroup<TweakOption>
          legend="选项样式"
          hint="圆形字母 (fenbi 风) 或方形 letter."
          value={state.option}
          onChange={(v) => setTweak('option', v)}
          options={OPTION_STYLE_OPTIONS}
        />
        <div className="pt-4 border-t border-line flex items-center justify-between">
          <span className="text-sm text-ink-3">恢复默认偏好.</span>
          <button
            type="button"
            onClick={reset}
            className={cn(
              'text-sm font-medium text-ink-3 hover:text-ink',
              'transition-colors duration-fast underline-offset-4 hover:underline',
              'focus-visible:outline-none focus-visible:underline',
            )}
            data-testid="tweaks-reset"
          >
            重置
          </button>
        </div>
      </div>
    </SidePanel>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Toggle group primitive (radio 语义, 视觉为 segmented control)
 * ────────────────────────────────────────────────────────────────────────── */

interface ToggleOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

interface ToggleGroupProps<V extends string> {
  readonly legend: string;
  readonly hint?: string;
  readonly value: V;
  readonly onChange: (next: V) => void;
  readonly options: ReadonlyArray<ToggleOption<V>>;
}

function ToggleGroup<V extends string>({
  legend,
  hint,
  value,
  onChange,
  options,
}: ToggleGroupProps<V>) {
  // useId 保证 fieldset id 唯一 (多个 ToggleGroup 实例并存时), aria-describedby
  // 指向 hint span. radiogroup 用 fieldset/legend 语义比 div role="radiogroup"
  // 屏读器更友好, 不需手挂 aria-label.
  const hintId = useId();
  return (
    <fieldset
      className="space-y-3"
      aria-describedby={hint != null ? hintId : undefined}
    >
      <legend className="text-tiny font-semibold tracking-eyebrow uppercase text-ink-3">
        {legend}
      </legend>
      {hint != null ? (
        <p id={hintId} className="text-sm text-ink-3 leading-relaxed">
          {hint}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-label={legend}
        className={cn(
          'inline-flex items-stretch border border-line rounded-tiny overflow-hidden',
          'bg-surface',
        )}
      >
        {options.map((opt, idx) => {
          const selected = opt.value === value;
          // 中间 item 用 border-l/r 跟邻居形成 1px 分隔, 最外两端不画外缘
          // (容器 border 已包).
          const isFirst = idx === 0;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              data-testid={`tweak-${legend}-${opt.value}`}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors duration-fast',
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
    </fieldset>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Option lookup tables (frozen per file load — no caller mutation)
 * ────────────────────────────────────────────────────────────────────────── */

const THEME_OPTIONS: ReadonlyArray<ToggleOption<TweakTheme>> = [
  { value: 'reading', label: '纸读' },
  { value: 'pure', label: '素白' },
  { value: 'night', label: '夜读' },
];

const DENSITY_OPTIONS: ReadonlyArray<ToggleOption<TweakDensity>> = [
  { value: 'compact', label: '紧凑' },
  { value: 'cozy', label: '舒适' },
];

const READING_OPTIONS: ReadonlyArray<ToggleOption<TweakReading>> = [
  { value: 'md', label: '标准' },
  { value: 'lg', label: '大字' },
  { value: 'xl', label: '特大' },
];

const NAV_OPTIONS: ReadonlyArray<ToggleOption<TweakNav>> = [
  { value: 'left', label: '左侧' },
  { value: 'top', label: '顶部' },
];

const OPTION_STYLE_OPTIONS: ReadonlyArray<ToggleOption<TweakOption>> = [
  { value: 'circle', label: '圆形' },
  { value: 'square', label: '方形' },
];

// Re-export TweakState type for caller convenience. Hook 自身 export 也行,
// 但此处避免 caller 知道 hooks/ 目录路径.
export type { TweakState };
