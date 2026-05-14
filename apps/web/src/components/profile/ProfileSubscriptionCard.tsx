import { Button, Card } from '@sikao/ui/ui';

// ProfileSubscriptionCard · SIKAO redesign Wave 1 · view 08 hifi "订阅" 区.
//
// hifi 原型 (SIKAO Redesign.html L3402-3413):
//   h3 订阅 (margin-top 48px)
//   大订阅卡 (1fr | auto grid, paper-2 bg, rule border, 24px pad):
//     左: eyebrow PREMIUM · 月度订阅 + 续订日期 serif 22 + 含权益 caption
//     右: mono ¥38 / 月 (text-right) + btn-secondary btn-sm "管理订阅"
//
// 当前 BE 0 个 subscription endpoint, 全部 props 由 caller 传 mock + TODO
// (BE owner 上 ship /me/subscription 后再 wire).
//
// Card variant="muted": bg-surface-alt (= var(--paper-2) = var(--paper-2))
// + border-line + text-ink. 1:1 对齐 hifi `.background: var(--paper-2);
// border: 1px solid var(--line-2)`.

export interface ProfileSubscriptionCardProps {
  readonly tierLabel: string;
  readonly billingCycle: string;
  readonly renewDate: string | null;
  readonly perks: readonly string[];
  readonly priceLabel: string;
  readonly priceCycle: string;
  readonly onManage: () => void;
}

export function ProfileSubscriptionCard({
  tierLabel,
  billingCycle,
  renewDate,
  perks,
  priceLabel,
  priceCycle,
  onManage,
}: ProfileSubscriptionCardProps) {
  return (
    <section className="mt-12" data-testid="profile-subscription-section">
      <h3 className="font-serif text-h-card font-medium text-ink pb-3 border-b border-line mb-4">
        订阅
      </h3>
      <Card variant="muted" padding="md" data-testid="profile-subscription-card">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <span className="block text-tiny font-mono tracking-eyebrow text-ink-3 uppercase">
              {tierLabel} · {billingCycle}
            </span>
            <p className="mt-2 font-serif text-h-card font-medium text-ink">
              {renewDate !== null ? `续订于 ${renewDate}` : '尚未订阅'}
            </p>
            <p className="mt-1 text-sm text-ink-3">{perks.join(' · ')}</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono tabular-nums text-xl text-ink">
              <span>{priceLabel}</span>
              <span className="text-sm text-ink-3"> / {priceCycle}</span>
            </div>
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onManage}
                data-testid="profile-subscription-manage-btn"
              >
                管理订阅
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
