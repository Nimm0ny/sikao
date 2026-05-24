import { isAxiosError } from 'axios';
import type {
  PracticePreferencesPutRequestV2,
  PracticePreferencesResponseV2,
} from '@sikao/api-client/types/practice';

export type PreferencesSection = 'ui' | 'pacing' | 'auto_save' | 'keyboard' | 'reminders' | 'custom_practice';
export type Message = { readonly variant: 'ok' | 'warn' | 'err'; readonly title: string; readonly description?: string };

export interface LocalUiPreferences {
  answerPanelPosition: 'right' | 'bottom';
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  lineHeight: 'compact' | 'comfortable' | 'spacious';
  showOvertimeWarning: boolean;
  showQuestionIndex: boolean;
  showTimingIndicator: boolean;
  themePreference: 'system' | 'light' | 'dark';
}

export interface LocalPacingPreferences {
  autoAdvanceAfterAnswer: boolean;
  autoAdvanceDelaySeconds: number;
  confirmBeforeSubmit: boolean;
  confirmWhenUnansweredCountGte: number;
  defaultPracticeMode: 'per_question' | 'full_set';
}

export interface LocalAutoSavePreferences {
  enabled: boolean;
  intervalSeconds: number;
  saveToLocalStorage: boolean;
}

export interface LocalKeyboardBindings {
  favorite: string;
  flagUncertain: string;
  nextQuestion: string;
  note: string;
  prevQuestion: string;
  selectA: string;
  selectB: string;
  selectC: string;
  selectD: string;
  submit: string;
}

export interface LocalKeyboardPreferences {
  enabled: boolean;
  bindings: LocalKeyboardBindings;
}

export interface LocalReminderPreferences {
  dailyPracticeReminderEnabled: boolean;
  dailyPracticeReminderTime: string;
  longSessionBreakReminderMinutes: number;
  overtimeThresholdSeconds: number;
  weeklySummaryReminderEnabled: boolean;
}

export interface LocalCustomPracticePreferences {
  lastUsedCount: 5 | 10 | 15 | 20 | 30;
  lastUsedDifficultyRange: [number, number];
  lastUsedExcludeDone: boolean;
  lastUsedOnlyWrong: boolean;
  lastUsedPracticeMode: 'per_question' | 'full_set';
  lastUsedSourceMode: 'real_exam' | 'ai_generated';
  lastUsedYearRange: 'all' | 'recent_3' | 'recent_5' | 'recent_10';
}

export interface LocalPreferencesPayload {
  ui: LocalUiPreferences;
  pacing: LocalPacingPreferences;
  autoSave: LocalAutoSavePreferences;
  keyboard: LocalKeyboardPreferences;
  reminders: LocalReminderPreferences;
  customPractice: LocalCustomPracticePreferences;
}

export function buildDefaultPayload(): LocalPreferencesPayload {
  return {
    ui: {
      answerPanelPosition: 'right',
      fontSize: 'base',
      lineHeight: 'comfortable',
      showOvertimeWarning: true,
      showQuestionIndex: true,
      showTimingIndicator: true,
      themePreference: 'system',
    },
    pacing: {
      autoAdvanceAfterAnswer: false,
      autoAdvanceDelaySeconds: 1,
      confirmBeforeSubmit: true,
      confirmWhenUnansweredCountGte: 1,
      defaultPracticeMode: 'full_set',
    },
    autoSave: {
      enabled: true,
      intervalSeconds: 30,
      saveToLocalStorage: true,
    },
    keyboard: {
      enabled: true,
      bindings: {
        selectA: 'a',
        selectB: 'b',
        selectC: 'c',
        selectD: 'd',
        nextQuestion: 'ArrowRight',
        prevQuestion: 'ArrowLeft',
        flagUncertain: 'f',
        favorite: 's',
        note: 'n',
        submit: 'Ctrl+Enter',
      },
    },
    reminders: {
      dailyPracticeReminderEnabled: false,
      dailyPracticeReminderTime: '20:00',
      weeklySummaryReminderEnabled: false,
      overtimeThresholdSeconds: 0,
      longSessionBreakReminderMinutes: 0,
    },
    customPractice: {
      lastUsedSourceMode: 'real_exam',
      lastUsedYearRange: 'recent_3',
      lastUsedDifficultyRange: [0, 1],
      lastUsedCount: 10,
      lastUsedPracticeMode: 'full_set',
      lastUsedExcludeDone: true,
      lastUsedOnlyWrong: false,
    },
  };
}

export function mergePayload(payload?: PracticePreferencesResponseV2['payload']): LocalPreferencesPayload {
  const defaults = buildDefaultPayload();
  return {
    ui: { ...defaults.ui, ...(payload?.ui ?? {}) },
    pacing: { ...defaults.pacing, ...(payload?.pacing ?? {}) },
    autoSave: { ...defaults.autoSave, ...(payload?.autoSave ?? {}) },
    keyboard: {
      enabled: payload?.keyboard?.enabled ?? defaults.keyboard.enabled,
      bindings: {
        ...defaults.keyboard.bindings,
        ...(payload?.keyboard?.bindings ?? {}),
      },
    },
    reminders: { ...defaults.reminders, ...(payload?.reminders ?? {}) },
    customPractice: { ...defaults.customPractice, ...(payload?.customPractice ?? {}) },
  };
}

export function toWirePayload(payload: LocalPreferencesPayload): PracticePreferencesPutRequestV2['payload'] {
  return {
    ui: { ...payload.ui },
    pacing: { ...payload.pacing },
    autoSave: { ...payload.autoSave },
    keyboard: { enabled: payload.keyboard.enabled, bindings: { ...payload.keyboard.bindings } },
    reminders: { ...payload.reminders },
    customPractice: { ...payload.customPractice },
  };
}

export function flattenPatchEntries(prefix: string, value: unknown): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) return [{ path: prefix, value }];
  if (typeof value !== 'object' || value === null) return [{ path: prefix, value }];
  return Object.entries(value).flatMap(([key, child]) => flattenPatchEntries(`${prefix}.${key}`, child));
}

export function buildPatchRequest(payload: LocalPreferencesPayload, schemaVersion: number) {
  return {
    schemaVersion,
    patches: [
      ...flattenPatchEntries('ui', payload.ui),
      ...flattenPatchEntries('pacing', payload.pacing),
      ...flattenPatchEntries('autoSave', payload.autoSave),
      ...flattenPatchEntries('keyboard', payload.keyboard),
      ...flattenPatchEntries('reminders', payload.reminders),
      ...flattenPatchEntries('customPractice', payload.customPractice),
    ],
  };
}

export function fromTimeString(value: string): { h: number; m: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

export function toTimeString(value: { h: number; m: number } | null): string {
  if (value === null) return '20:00';
  return `${String(value.h).padStart(2, '0')}:${String(value.m).padStart(2, '0')}`;
}

export function normalizeInteger(raw: string, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

export function buildKeyboardDuplicateMessage(bindings: LocalKeyboardBindings): Message | null {
  const values = Object.values(bindings)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const duplicates = values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
  if (duplicates.length === 0) return null;
  return {
    variant: 'err',
    title: '键位存在重复',
    description: `重复键位：${Array.from(new Set(duplicates)).join('、')}。请先调整后再保存。`,
  };
}

export function isSchemaMismatch(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const data = error.response?.data;
  return typeof data === 'object' && data !== null && 'code' in data && data.code === 'schema_version_mismatch';
}
