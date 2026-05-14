import { useCallback, useEffect, useState } from 'react';

/**
 * SIKAO Tweak Protocol — 全局阅读偏好.
 *
 * 设计 SSOT: `design/SIKAO/extracted/tweaks-protocol.md` + `handoff/CLAUDE.md`
 * §「Tweak 协议（必做）」: theme / density / reading / nav / option 5 个开关
 * 同步到 `<html data-*>` 属性, tokens.css 通过 attribute selector 反应样式.
 *
 * Persistence: localStorage key `sikao.tweaks`. 跨 tab 不双向同步 (每 tab
 * 自己读), 写入瞬时. JSON 解析失败回退 DEFAULTS (跟 useThemeStore 同款软化
 * fail-fast — UI 偏好 corruption 不应炸 layout).
 *
 * **跟 useApplyExamTheme 的边界**:
 *   useApplyExamTheme (考场态守卫) mount 时把 `<html data-theme>` 写为
 *   examTheme ('light' | 'dark'), unmount 时 removeAttribute. 离开考场态
 *   `data-theme` 属性消失, useTweaks 的 reading/pure/night 偏好需要重新写入.
 *   因此 useTweaks 用 effect 监听 state 变化 + 在 mount 重新 apply, 让
 *   route 切换回 app 视图时偏好恢复. 考场态期间 tweaks 偏好被 examTheme
 *   覆盖是预期行为 (考场态优先, follow-up: 推后续把 useThemeStore 改为
 *   保留 tweaks state 的形式).
 */

export type TweakTheme = 'reading' | 'pure' | 'night';
export type TweakDensity = 'compact' | 'cozy';
export type TweakReading = 'md' | 'lg' | 'xl';
export type TweakNav = 'left' | 'top';
export type TweakOption = 'circle' | 'square';

export interface TweakState {
  readonly theme: TweakTheme;
  readonly density: TweakDensity;
  readonly reading: TweakReading;
  readonly nav: TweakNav;
  readonly option: TweakOption;
}

export const TWEAK_DEFAULTS: TweakState = {
  theme: 'reading',
  density: 'compact',
  reading: 'md',
  nav: 'left',
  option: 'circle',
};

const STORAGE_KEY = 'sikao.tweaks';

const VALID_THEME: ReadonlySet<TweakTheme> = new Set(['reading', 'pure', 'night']);
const VALID_DENSITY: ReadonlySet<TweakDensity> = new Set(['compact', 'cozy']);
const VALID_READING: ReadonlySet<TweakReading> = new Set(['md', 'lg', 'xl']);
const VALID_NAV: ReadonlySet<TweakNav> = new Set(['left', 'top']);
const VALID_OPTION: ReadonlySet<TweakOption> = new Set(['circle', 'square']);

/** Type-guard 解析 — 拒绝任意 unknown JSON, 只接受合法枚举值. */
function parseTweaks(raw: unknown): TweakState {
  if (raw === null || typeof raw !== 'object') return TWEAK_DEFAULTS;
  const r = raw as Record<string, unknown>;
  const theme = VALID_THEME.has(r.theme as TweakTheme)
    ? (r.theme as TweakTheme)
    : TWEAK_DEFAULTS.theme;
  const density = VALID_DENSITY.has(r.density as TweakDensity)
    ? (r.density as TweakDensity)
    : TWEAK_DEFAULTS.density;
  const reading = VALID_READING.has(r.reading as TweakReading)
    ? (r.reading as TweakReading)
    : TWEAK_DEFAULTS.reading;
  const nav = VALID_NAV.has(r.nav as TweakNav) ? (r.nav as TweakNav) : TWEAK_DEFAULTS.nav;
  const option = VALID_OPTION.has(r.option as TweakOption)
    ? (r.option as TweakOption)
    : TWEAK_DEFAULTS.option;
  return { theme, density, reading, nav, option };
}

function readState(): TweakState {
  if (typeof window === 'undefined') return TWEAK_DEFAULTS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return TWEAK_DEFAULTS;
  // 软化 fail-fast: UI 偏好 corruption 回退 DEFAULTS, 不炸 layout.
  // 跟 useApplyExamTheme / readCollapsed 同款策略.
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseTweaks(parsed);
  } catch {
    return TWEAK_DEFAULTS;
  }
}

function writeState(state: TweakState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 把 TweakState 应用到 `<html>` 的 data-* 属性.
 *
 * theme=reading 是 :root 默认值, 不写 attribute 让 useApplyExamTheme 接管;
 * 其他 theme 显式写 data-theme. density / reading / nav / option 始终写,
 * 让 CSS attribute selector 命中.
 */
function applyToDom(state: TweakState): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  // theme=reading 不写让 :root 默认生效, 跟考场态守卫 removeAttribute 配合.
  if (state.theme === 'reading') {
    // 仅清 useTweaks 写过的非默认值; 不动考场态可能写的 'light' / 'dark'.
    if (html.dataset.theme === 'pure' || html.dataset.theme === 'night') {
      html.removeAttribute('data-theme');
    }
  } else {
    html.dataset.theme = state.theme;
  }
  html.dataset.density = state.density;
  html.dataset.reading = state.reading;
  html.dataset.nav = state.nav;
  html.dataset.option = state.option;
}

export interface UseTweaksReturn {
  readonly state: TweakState;
  readonly setTweak: <K extends keyof TweakState>(key: K, value: TweakState[K]) => void;
  readonly reset: () => void;
}

/**
 * 全局阅读偏好 hook. 在顶层 layout (或 main.tsx 接近 mount) 调用一次,
 * 让 SSR-safe init + 持久化 + DOM 同步走通.
 *
 * 多次调用各自独立的 state — 调用方需自己保证只在 layout 顶层挂一次, 否则
 * 多份 state 不同步. 当前 frontend 没有 zustand store 的同步保证 (SIKAO
 * tweak 是 UI 偏好, 不需要 zustand 跨组件 broadcast — 只有 TweaksDrawer
 * 是 producer, 其他 view 通过 CSS attr 间接 consumer).
 */
export function useTweaks(): UseTweaksReturn {
  // SSR-safe: lazy init, 不在 useState initializer 里碰 window 之外的 API.
  const [state, setState] = useState<TweakState>(() => readState());

  // mount 后第一帧把当前 state 写到 DOM. effect 也保证 state 改变时 sync.
  useEffect(() => {
    applyToDom(state);
  }, [state]);

  const setTweak = useCallback(
    <K extends keyof TweakState>(key: K, value: TweakState[K]): void => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        writeState(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback((): void => {
    setState(TWEAK_DEFAULTS);
    writeState(TWEAK_DEFAULTS);
  }, []);

  return { state, setTweak, reset };
}
