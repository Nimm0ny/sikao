import { Card } from '@sikao/ui/ui';
import type { PracticeSubjectSummaryV2 } from '@sikao/api-client/types/api';

// Mirrors design/scenes/result.jsx ResultA §65-77 (3-card row, 我们做前 2 张).
// Per docs/plan/result-deep-analysis.md slice 3 (D3.B subject 维度作强项卡).
//
// Surface logic:
//   - 强项 = accuracy_rate 最高的 subject (要求 answered_questions > 0)
//   - 需巩固 = accuracy_rate 最低的 subject (要求 answered_questions > 0)
//   - 若不足 2 个有效 subject 或两者是同一个 subject → return null
//     (单 subject 既强又弱无意义, 不要给用户假数据).
//
// 不放第 3 张 "AI 建议" 卡 — 那是 slice 4 单独组件 (deterministic template
// based on weakest subtype, not subject).

export interface StrengthWeaknessCardsProps {
  readonly subjects: readonly PracticeSubjectSummaryV2[];
}

interface CardBlockProps {
  readonly eyebrow: string;
  readonly eyebrowClass: string;
  readonly subject: string;
  readonly meta: string;
  readonly testId: string;
}

function CardBlock({ eyebrow, eyebrowClass, subject, meta, testId }: CardBlockProps) {
  return (
    <Card padding="md" data-testid={testId}>
      <div className={`text-tiny ${eyebrowClass} mb-1`}>{eyebrow}</div>
      <div className="font-bold text-ink text-base">{subject}</div>
      <div className="text-sm text-ink-3 mt-1 tabular-nums">{meta}</div>
    </Card>
  );
}

export function StrengthWeaknessCards({ subjects }: StrengthWeaknessCardsProps) {
  const answered = subjects.filter((s) => s.answeredQuestions > 0);
  if (answered.length < 2) return null;
  const sorted = [...answered].sort((a, b) => b.accuracyRate - a.accuracyRate);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  if (strongest.subject === weakest.subject) return null;
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-3"
      data-testid="strength-weakness-cards"
    >
      <CardBlock
        eyebrow="强项"
        eyebrowClass="text-ok"
        subject={strongest.subject}
        meta={`准确率 ${strongest.accuracyRate}%`}
        testId="strength-card"
      />
      <CardBlock
        eyebrow="需巩固"
        eyebrowClass="text-warn"
        subject={weakest.subject}
        meta={`准确率 ${weakest.accuracyRate}% · 错 ${weakest.wrongCount} 题 / ${weakest.answeredQuestions}`}
        testId="weakness-card"
      />
    </div>
  );
}
