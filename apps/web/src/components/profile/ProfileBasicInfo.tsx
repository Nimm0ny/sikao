import type { ReactNode } from 'react';
import { Button } from '@sikao/ui/ui';
import type { AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { PROFILE_COPY } from '@/lib/ui-copy';

// ProfileBasicInfo · SIKAO redesign Wave 1 · view 08 hifi "基本资料" 区.
//
// hifi 原型 (SIKAO Redesign.html L3388-3394):
//   eyebrow ACCOUNT
//   h3 基本资料 (serif 22 + 下划 border-line-2)
//   .kv 200|1fr 网格, 14px 上下 padding, border-bottom rule:
//     - 姓名 林墨 [编辑]
//     - 手机 138 **** 4291 (mono)
//     - 邮箱 linmo@qq.com
//     - 目标考试 2026 国考 · 副省级 [更换]
//     - 报考地区 江苏 · 南京
//
// 数据契约:
//   - user (AuthUserSummary): displayName / phone / email — BE 已有.
//   - examTarget / examRegion BE 暂无字段, caller 传 mock + TODO.
//
// "编辑" / "更换" 按钮目前无 wire, 走 onClick prop (caller 决定 noop / navigate
// / open modal). Phase 后续接 PUT /me/profile 时再扩.

export interface ProfileBasicInfoProps {
  readonly user: AuthUserSummary;
  readonly examTarget: string | null;
  readonly examRegion: string | null;
  readonly onEditName?: () => void;
  readonly onChangeExamTarget?: () => void;
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

function maskPhone(phone: string | null | undefined): string {
  if (phone === null || phone === undefined || phone.length < 7) return '—';
  // 138 **** 4291 — 抽样 design hifi 的脱敏样式
  return `${phone.slice(0, 3)} **** ${phone.slice(-4)}`;
}

export function ProfileBasicInfo({
  user,
  examTarget,
  examRegion,
  onEditName,
  onChangeExamTarget,
}: ProfileBasicInfoProps) {
  return (
    <section data-testid="profile-basic-info-section">
      <span className="block text-tiny font-mono tracking-eyebrow text-ink-3 uppercase">
        {PROFILE_COPY.basicInfoEyebrow}
      </span>
      <h3 className="mt-2 font-serif text-h-card font-medium text-ink pb-3 border-b border-line">
        {PROFILE_COPY.basicInfoTitle}
      </h3>

      <KvRow label={PROFILE_COPY.basicInfoNameLabel} testId="profile-kv-name">
        <span className="inline-flex items-center gap-3">
          <span>{user.displayName ?? '—'}</span>
          {onEditName !== undefined ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={onEditName}
              data-testid="profile-edit-name-btn"
            >
              {PROFILE_COPY.basicInfoEditAction}
            </Button>
          ) : null}
        </span>
      </KvRow>
      <KvRow label={PROFILE_COPY.basicInfoPhoneLabel} testId="profile-kv-phone">
        <span className="font-mono tabular-nums">{maskPhone(user.phone)}</span>
      </KvRow>
      <KvRow label={PROFILE_COPY.basicInfoEmailLabel} testId="profile-kv-email">
        <span>{user.email ?? '—'}</span>
      </KvRow>
      <KvRow label={PROFILE_COPY.basicInfoTargetLabel} testId="profile-kv-exam-target">
        <span className="inline-flex items-center gap-3">
          <span>{examTarget ?? '—'}</span>
          {onChangeExamTarget !== undefined ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={onChangeExamTarget}
              data-testid="profile-change-exam-btn"
            >
              {PROFILE_COPY.basicInfoChangeAction}
            </Button>
          ) : null}
        </span>
      </KvRow>
      <KvRow label={PROFILE_COPY.basicInfoRegionLabel} testId="profile-kv-region">
        <span>{examRegion ?? '—'}</span>
      </KvRow>
    </section>
  );
}
