import { Card, ProgressBar } from '@sikao/ui/ui';
import type { PracticeSectionSummaryV2 } from '@sikao/api-client/types/api';
import { RESULT_COPY } from '@/lib/ui-copy';

// Mirrors docs/ui-demo/ui-preview.html §457-461 — `分区正确率` Card with
// per-section bars. The demo computes accuracy client-side; we use the
// backend-provided accuracyRate (0..1) and only render derived counts.

export interface SectionAccuracyCardProps {
  readonly sections: readonly PracticeSectionSummaryV2[];
}

interface SectionRowProps {
  readonly section: PracticeSectionSummaryV2;
}

// Phase 5.6 E2E fix: 后端 PracticeSectionSummaryV2.accuracyRate 是 0-100
// percent（见 _build_section_summaries: round(correct/answered*100, 1)），
// 不是 0-1 比率。E2E 验证 2/3 显示 100% 暴露契约错配 —— 之前 clamp(rate, 0, 1)
// 让 67 也被截到 1 显示 100%。
function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${Math.round(Math.max(0, Math.min(100, rate)))}%`;
}

function SectionRow({ section }: SectionRowProps) {
  const percent = formatPercent(section.accuracyRate);
  const ariaLabel = `${section.title} 正确率`;
  return (
    <div className="flex flex-col gap-2" data-testid={`section-row-${section.sectionId}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-ink truncate">{section.title}</span>
        <span className="text-ink-3 tabular-nums shrink-0 ml-3">
          {section.correctCount} / {section.questionCount} ·{' '}
          <b className="font-serif italic text-ink">{percent}</b>
        </span>
      </div>
      <ProgressBar value={section.accuracyRate} max={100} ariaLabel={ariaLabel} size="sm" />
    </div>
  );
}

export function SectionAccuracyCard({ sections }: SectionAccuracyCardProps) {
  if (sections.length === 0) return null;
  return (
    <Card padding="md" data-testid="section-accuracy-card">
      <h3 className="font-bold text-ink mb-4">{RESULT_COPY.sectionAccuracyTitle}</h3>
      <div className="space-y-4">
        {sections.map((section) => (
          <SectionRow key={section.sectionId} section={section} />
        ))}
      </div>
    </Card>
  );
}
