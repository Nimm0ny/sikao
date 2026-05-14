/**
 * SIKAO Wave 3 PR0 · 07 hifi PlanAssistant (sikao-redesign plan §0.4).
 *
 * Hifi spec (line 3354-3363):
 *   - margin-top 48px + padding 24px + bg paper-2 + 1px rule border
 *   - eyebrow "PLAN ASSISTANT"
 *   - 内容: grid 1fr/auto + gap 24px
 *     - 左: serif 18px line-height 1.55 文案 (建议正文)
 *     - 右: 2 button (btn-secondary "不用，按原计划" + btn-primary "好，调整一下")
 *
 * PR0: ASSISTANT 文案硬编码 (按周状态切换 1-3 条 fallback). PR2 (LLM 接入) 后
 * BE 返 narrative 字段, props 接 narrative + 2 actions.
 *
 * Design system primitive: 用 Card variant=muted (paper-2 + 1px rule + 无圆角默认),
 * 走 components/ui/Card.tsx muted variant SSOT (已有 SIKAO Phase 1' 落地, 见
 * Card.tsx line 44-47 注释).
 *
 * onAction handler 回调 (PR0: 仅 console-free no-op log via toast 提示
 * "PR2 接入后生效"; PR2 后接 LLM 调整请求).
 */
import type { ReactElement } from 'react';
import { Card } from '@sikao/ui/ui/Card';

export interface PlanAssistantAction {
  readonly id: 'keep' | 'adjust';
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: 'primary' | 'secondary';
}

export interface PlanAssistantProps {
  readonly headline?: string;
  readonly narrative: string;
  readonly actions: readonly PlanAssistantAction[];
}

export function PlanAssistant({
  headline = 'PLAN ASSISTANT',
  narrative,
  actions,
}: PlanAssistantProps): ReactElement {
  return (
    <Card
      variant="muted"
      padding="md"
      data-testid="plan-assistant"
      // hifi 1080: margin-top 48px (mt-12 = 48px in tailwind 0.25rem step).
      className="mt-12"
    >
      <div
        className="font-mono uppercase tracking-eyebrow text-tiny text-[color:var(--ink-3)]"
        data-testid="plan-assistant-eyebrow"
      >
        {headline}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-[var(--sp-5)] items-center mt-2">
        <p
          className="m-0 font-serif text-lg leading-[1.55] text-[color:var(--ink-1)]"
          data-testid="plan-assistant-narrative"
        >
          {narrative}
        </p>
        <div className="flex gap-3 flex-wrap">
          {actions.map((action) => (
            <AssistantButton key={action.id} action={action} />
          ))}
        </div>
      </div>
    </Card>
  );
}

interface AssistantButtonProps {
  readonly action: PlanAssistantAction;
}

function AssistantButton({ action }: AssistantButtonProps): ReactElement {
  const isPrimary = action.variant === 'primary';
  // hifi spec line 345-358: .btn h:36 padding:0 16, font-mono 12px,
  // .btn-primary bg ink color paper, .btn-secondary border ink color ink bg paper.
  // 走 inline class with token vars (走 Tailwind utility 也可, 但 hifi spec
  // 已规定具体值, 用 inline class 跟 hifi 直对齐避免 design drift).
  const base =
    'inline-flex items-center justify-center h-9 px-4 text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors duration-fast border';
  const tone = isPrimary
    ? 'bg-[color:var(--ink-1)] text-[color:var(--paper-1)] border-[color:var(--ink-1)] hover:bg-black'
    : 'bg-[color:var(--paper-1)] text-[color:var(--ink-1)] border-[color:var(--ink-1)] hover:bg-[color:var(--paper-2)]';
  return (
    <button
      type="button"
      onClick={action.onClick}
      className={`${base} ${tone}`}
      data-testid={`plan-assistant-action-${action.id}`}
    >
      {action.label}
    </button>
  );
}
