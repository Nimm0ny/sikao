import { Card } from '@sikao/ui/ui';
import { ESSAY_COPY, ESSAY_GRADING_COPY } from '@/lib/ui-copy';

// Slice 2d — 对照答案展示卡 (dumb, props-only).
//
// 本卡顶部一条小字 banner 明示"仅供对照, 非官方参考答案", 主体 plain text
// (whitespace-pre-wrap), 不走 markdown render — 防 HTML/script 经
// dangerouslySetInnerHTML 出 XSS.
//
// sampleAnswer=null 时整卡不渲染 (sanity check 失败的兜底; 上层 GradingResult
// 决定渲不渲).

export interface SampleAnswerCardProps {
  readonly sampleAnswer: string | null;
  readonly className?: string;
}

export function SampleAnswerCard({
  sampleAnswer,
  className,
}: SampleAnswerCardProps) {
  if (sampleAnswer === null || sampleAnswer.trim() === '') return null;

  const charCount = sampleAnswer.length;

  return (
    <Card
      as="section"
      padding="md"
      className={className}
      data-testid="essay-sample-answer-card"
    >
      <header className="mb-3">
        <h3 className="text-md font-medium text-ink mb-1">
          {ESSAY_GRADING_COPY.sampleAnswerTitle}
        </h3>
        <p
          className="text-tiny font-mono tracking-loose text-ink-3"
          data-testid="essay-sample-answer-banner"
        >
          {ESSAY_GRADING_COPY.sampleAnswerBanner}
        </p>
      </header>
      <p
        className="text-md text-ink leading-relaxed whitespace-pre-wrap"
        data-testid="essay-sample-answer-body"
      >
        {sampleAnswer}
      </p>
      <footer className="mt-3 text-tiny font-mono tracking-loose text-ink-3">
        {ESSAY_COPY.wordCountFmt(charCount)}
      </footer>
    </Card>
  );
}
