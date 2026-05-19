import type { ReactNode } from 'react';
import { PROFILE_COPY } from '@/lib/ui-copy';

// ProfilePreferences · SIKAO redesign Wave 1 · view 08 hifi "偏好" 区.
//
// hifi 原型 (SIKAO Redesign.html L3396-3400):
//   h3 偏好 (margin-top 48px)
//   .kv 主题      [静读] [素白] [夜读] caption(在 Tweaks 中切换)
//   .kv 每日提醒  19:30 · 微信通知 + 邮件
//   .kv 字号      中 · 15 px
//   .kv 键盘快捷键 已开启 · ⌘K · ⌘/ · 1234
//
// 当前 SIKAO theme 切换在 Tweaks panel 完成, 此处仅展示当前激活 chip + 引导文案.
// 未来若 wire Tweaks 进入 Profile 内置, 可在此扩 onClick handler.
//
// 数据契约: 全部 caller 传 (themeKey / dailyReminder / fontSize / shortcutsOn).
// 暂时全部 mock — 文档 + 实际 Tweaks 切换状态合一在 Tweaks 上线后再 wire.

export type ProfileThemeKey = 'quiet' | 'pure' | 'night';

export interface ProfilePreferencesProps {
  readonly themeKey: ProfileThemeKey;
  readonly dailyReminder: string | null;
  readonly fontSizeLabel: string;
  readonly shortcutsOn: boolean;
}

interface KvRowProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly testId?: string;
}

function KvRow({ label, children, testId }: KvRowProps) {
  return (
    <div
      className="grid grid-cols-[140px_1fr] md:grid-cols-[200px_1fr] gap-4 py-4 border-b border-line items-center last:border-b-0"
      data-testid={testId}
    >
      <div className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
        {label}
      </div>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}

interface ChipProps {
  readonly active: boolean;
  readonly children: ReactNode;
}

function Chip({ active, children }: ChipProps) {
  // SIKAO chip token: rounded-tiny = var(--r-tiny) = 4px (CLAUDE.md §4 radius SSOT).
  // active 走 ink bg + paper text, inactive 走 line border + ink-muted.
  return (
    <span
      className={
        active
          ? 'inline-flex items-center rounded-tiny border border-ink bg-ink px-3 py-1 text-xs text-paper'
          : 'inline-flex items-center rounded-tiny border border-line bg-surface px-3 py-1 text-xs text-ink-3'
      }
    >
      {children}
    </span>
  );
}

export function ProfilePreferences({
  themeKey,
  dailyReminder,
  fontSizeLabel,
  shortcutsOn,
}: ProfilePreferencesProps) {
  return (
    <section className="mt-12" data-testid="profile-preferences-section">
      <h3 className="font-serif text-h-card font-medium text-ink pb-3 border-b border-line">
        {PROFILE_COPY.preferencesTitle}
      </h3>

      <KvRow label={PROFILE_COPY.preferencesThemeLabel} testId="profile-kv-theme">
        <span className="flex items-center gap-2 flex-wrap">
          <Chip active={themeKey === 'quiet'}>{PROFILE_COPY.preferencesThemeQuiet}</Chip>
          <Chip active={themeKey === 'pure'}>{PROFILE_COPY.preferencesThemePure}</Chip>
          <Chip active={themeKey === 'night'}>{PROFILE_COPY.preferencesThemeNight}</Chip>
          <span className="font-mono text-xs text-ink-3 ml-2">
            {PROFILE_COPY.preferencesThemeHint}
          </span>
        </span>
      </KvRow>
      <KvRow label={PROFILE_COPY.preferencesReminderLabel} testId="profile-kv-reminder">
        <span>{dailyReminder ?? PROFILE_COPY.preferencesReminderEmpty}</span>
      </KvRow>
      <KvRow label={PROFILE_COPY.preferencesFontLabel} testId="profile-kv-font">
        <span>{fontSizeLabel}</span>
      </KvRow>
      <KvRow label={PROFILE_COPY.preferencesShortcutsLabel} testId="profile-kv-shortcuts">
        <span>
          {shortcutsOn
            ? PROFILE_COPY.preferencesShortcutsEnabled
            : PROFILE_COPY.preferencesShortcutsDisabled}
        </span>
      </KvRow>
    </section>
  );
}
