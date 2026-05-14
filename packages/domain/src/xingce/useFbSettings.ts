import { useCallback, useEffect, useState } from 'react';
import { logger } from '@sikao/shared-utils';

/**
 * SIKAO Phase 3 P2 (2026-05-11): fb 答题考场态独立偏好.
 *
 * Scope:
 *   - density (cozy / compact): 段间留白 / 卡片 padding.
 *   - optStyle (circle / square): 选项 letter 形状 (Phase 3 P3a 扩).
 *   - 字号留给后续 polish.
 *   - 跟 useTweaks (dashboard 5 段 drawer SSOT) 解耦 — fb 考场态有独立偏好,
 *     存独立 storage key, 不污染 dashboard.
 *
 * Persistence: localStorage key `fb-settings-v1`. 跨 tab 不双向同步, 每个
 * fb session 自己读 + 写. 写入瞬时.
 *
 * Fail-Fast 软化 (CLAUDE.md §4 行为调优变量例外):
 *   localStorage corrupt JSON → logger.warn + 默认 cozy + circle. **不抛** —
 *   UI 偏好 corruption 不应炸 layout. 跟 useTweaks.readState() catch
 *   fallback 同款先例.
 *
 * Caller 责任:
 *   PracticeSession 在 mount apply density + optStyle 到 <html data-density>
 *   和 <html data-opt-style>. unmount 不 reset (让 useTweaks 在下一次
 *   dashboard 路由 mount 时 re-apply, 让 fb session 和 dashboard 各自独立).
 *
 * 为什么不用 zustand:
 *   fb settings 只有 1 producer (FbSettingsPopover) + 多 consumer (CSS attr
 *   selector + FbOpts data attribute). 不跨组件 broadcast (走 DOM), zustand
 *   收益为 0. 跟 useTweaks 同款 plain hook 模式.
 *
 * Migration:
 *   旧 storage `{ density: 'compact' }` (无 optStyle key) → 默认 circle, 无痛.
 */

export type FbDensity = 'cozy' | 'compact';
export type FbOptStyle = 'circle' | 'square';

export interface FbSettings {
  readonly density: FbDensity;
  readonly optStyle: FbOptStyle;
}

export const FB_SETTINGS_DEFAULTS: FbSettings = {
  density: 'cozy',
  // circle = 当前 FbOpts rounded-pill 一致, 不破老用户预期 (Phase 3 之前隐式默认).
  optStyle: 'circle',
};

const STORAGE_KEY = 'fb-settings-v1';

const VALID_DENSITY: ReadonlySet<FbDensity> = new Set(['cozy', 'compact']);
const VALID_OPT_STYLE: ReadonlySet<FbOptStyle> = new Set(['circle', 'square']);

function parseSettings(raw: unknown): FbSettings {
  if (raw === null || typeof raw !== 'object') return FB_SETTINGS_DEFAULTS;
  const r = raw as Record<string, unknown>;
  const density = VALID_DENSITY.has(r.density as FbDensity)
    ? (r.density as FbDensity)
    : FB_SETTINGS_DEFAULTS.density;
  const optStyle = VALID_OPT_STYLE.has(r.optStyle as FbOptStyle)
    ? (r.optStyle as FbOptStyle)
    : FB_SETTINGS_DEFAULTS.optStyle;
  return { density, optStyle };
}

function readState(): FbSettings {
  if (typeof window === 'undefined') return FB_SETTINGS_DEFAULTS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return FB_SETTINGS_DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseSettings(parsed);
  } catch {
    // UI 偏好 corruption 不应炸 layout — log + 默认值.
    logger.warn('fb-settings.parse-fallback', { raw });
    return FB_SETTINGS_DEFAULTS;
  }
}

function writeState(state: FbSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyToDom(state: FbSettings): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.density = state.density;
  document.documentElement.dataset.optStyle = state.optStyle;
}

export interface UseFbSettingsReturn {
  readonly settings: FbSettings;
  readonly setDensity: (next: FbDensity) => void;
  readonly setOptStyle: (next: FbOptStyle) => void;
}

/**
 * fb 答题考场态独立偏好 hook. 在 PracticeSession 顶层调一次, 保证 SSR-safe
 * init + 持久化 + DOM 同步.
 *
 * 多次调用各自独立的 state — 调用方需保证只在 PracticeSession 顶层挂一次.
 */
export function useFbSettings(): UseFbSettingsReturn {
  const [settings, setSettings] = useState<FbSettings>(() => readState());

  useEffect(() => {
    applyToDom(settings);
  }, [settings]);

  const setDensity = useCallback((next: FbDensity): void => {
    setSettings((prev) => {
      const nextSettings = { ...prev, density: next };
      writeState(nextSettings);
      return nextSettings;
    });
  }, []);

  const setOptStyle = useCallback((next: FbOptStyle): void => {
    setSettings((prev) => {
      const nextSettings = { ...prev, optStyle: next };
      writeState(nextSettings);
      return nextSettings;
    });
  }, []);

  return { settings, setDensity, setOptStyle };
}
