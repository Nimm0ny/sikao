import { ESSAY_GRADING_COPY } from '@/lib/ui-copy';

// Slice 2d — 优 / 缺 / 建议 三 list (dumb, props-only).
//
// 三 list 各空数组时该 section 不渲染。全空时整卡 return null.

export interface EssayFeedbackListsProps {
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly suggestions: readonly string[];
  readonly className?: string;
}

interface Section {
  readonly title: string;
  readonly items: readonly string[];
  readonly testId: string;
}

export function EssayFeedbackLists({
  strengths,
  weaknesses,
  suggestions,
  className,
}: EssayFeedbackListsProps) {
  const sections: readonly Section[] = [
    {
      title: ESSAY_GRADING_COPY.strengthsTitle,
      items: strengths,
      testId: 'essay-strengths',
    },
    {
      title: ESSAY_GRADING_COPY.weaknessesTitle,
      items: weaknesses,
      testId: 'essay-weaknesses',
    },
    {
      title: ESSAY_GRADING_COPY.suggestionsTitle,
      items: suggestions,
      testId: 'essay-suggestions',
    },
  ];

  const visible = sections.filter((s) => s.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className={className} data-testid="essay-feedback-lists">
      {visible.map((s) => (
        <section key={s.testId} className="mb-5 last:mb-0">
          <h4
            className="text-tiny font-mono tracking-loose uppercase text-ink-3 mb-2"
            data-testid={`${s.testId}-title`}
          >
            {s.title}
          </h4>
          <ul className="space-y-2" data-testid={s.testId}>
            {s.items.map((item, i) => (
              <li
                key={i}
                className="text-md text-ink leading-relaxed pl-4 relative before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-px before:bg-line-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
