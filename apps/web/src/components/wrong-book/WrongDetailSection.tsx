/**
 * SIKAO Wave 4 Phase 2D · DetailA 纵堆 collapsible section.
 *
 * 抽出便于 WrongQuestionDetailView ≤500 行.
 */
import { useState, type ReactNode } from 'react';
import { Card } from '@sikao/ui/ui';
import { ChevronDownIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';

export interface WrongDetailSectionProps {
  readonly num: string;
  readonly title: string;
  readonly meta: ReactNode;
  readonly children: ReactNode;
  readonly testId: string;
  readonly defaultOpen?: boolean;
}

export function WrongDetailSection({
  num,
  title,
  meta,
  children,
  testId,
  defaultOpen = true,
}: WrongDetailSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card
      as="section"
      padding="none"
      variant="default"
      className="mb-3"
      data-testid={testId}
    >
      <button
        type="button"
        className="w-full flex justify-between items-center px-6 py-3 border-b border-line cursor-pointer text-left"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        <h2 className="font-serif text-lg font-semibold flex items-center gap-3 m-0">
          <span className="font-mono text-xs font-medium text-ink-3 tracking-wider">
            {num}
          </span>
          <span>{title}</span>
        </h2>
        <div className="font-mono text-xs text-ink-3 tracking-loose flex items-center gap-3">
          {meta}
          <span
            className={cn(
              'transition-transform duration-base text-ink-3',
              !open && '-rotate-90',
            )}
            aria-hidden="true"
          >
            <ChevronDownIcon size={14} />
          </span>
        </div>
      </button>
      {open ? <div className="px-6 py-5">{children}</div> : null}
    </Card>
  );
}
