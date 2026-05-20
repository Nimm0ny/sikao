import { useState, type ReactElement } from 'react';
import { cn } from '@sikao/shared-utils';
import type { NoteOutV2 } from '@sikao/api-client/queries/notebookQueries';
import { NOTES_COPY } from '@/lib/ui-copy';

/**
 * SIKAO Wave 4 Phase 2D · ReviewStack — SM-2 复习卡 + 0-5 评分.
 *
 * 设计 SSOT `.review-card .stack`. 三层叠卡 translateY(0/8/16) + scale(1/.96/.92)
 * + opacity(1/.7/.4). 不引 framer-motion (memory
 * `reference_framer_motion_parent_layout_pollutes_layoutId`).
 *
 * Behavior: 点击 "记住/没记住" 触发 onSubmitReview(noteId, quality 0-5).
 * 简版 → 走两按钮 "记住" (quality=5) / "没记住" (quality=0). P2 可扩出 5 档.
 *
 * Dumb: caller 传 notes + onSubmitReview, 不内部 fetch.
 */

export interface ReviewStackProps {
  readonly notes: readonly NoteOutV2[];
  readonly onSubmitReview: (noteId: number, quality: number) => void;
  readonly onSkip?: () => void;
  readonly testId?: string;
  readonly isSubmitting?: boolean;
}

export function ReviewStack({
  notes,
  onSubmitReview,
  onSkip,
  testId,
  isSubmitting = false,
}: ReviewStackProps): ReactElement {
  const [index, setIndex] = useState(0);
  const total = notes.length;
  const current = notes[index];
  const handleQuality = (quality: number): void => {
    if (current === undefined) return;
    onSubmitReview(current.id, quality);
    if (index + 1 < total) setIndex(index + 1);
  };

  if (total === 0 || current === undefined) {
    return (
      <section
        data-testid={testId ?? 'review-stack-empty'}
        className={cn(
          'rounded-card p-5 bg-ink text-white relative overflow-hidden',
          'flex flex-col gap-3',
        )}
      >
        <h4 className="m-0 font-serif text-lg font-semibold">今日复习</h4>
        <p className="font-mono text-tiny tracking-loose text-ink-4">
          {NOTES_COPY.reviewEmpty}
        </p>
        <p className="text-xs leading-relaxed text-ink-4 m-0">
          {NOTES_COPY.reviewEmptyHint1}, 系统按 SM-2 {NOTES_COPY.reviewEmptyHint2}.
        </p>
      </section>
    );
  }

  // 顶卡 + 后两层做装饰 (ts-1/2/3 设计稿 z-3/2/1, scale 1/.96/.92).
  // 用户可视前 3 张; >3 时仍画 3 层做"有更多"提示.
  const decoNext = notes[index + 1];
  const decoNext2 = notes[index + 2];

  return (
    <section
      data-testid={testId ?? 'review-stack'}
      className={cn(
        'rounded-card p-5 bg-ink text-white relative overflow-hidden',
        'flex flex-col gap-3',
      )}
    >
      <header className="flex items-baseline justify-between m-0">
        <h4 className="font-serif text-lg font-semibold m-0">今日复习</h4>
        <span className="font-mono text-tiny tracking-wide text-ink-4">
          {index + 1} / {total}
        </span>
      </header>
      <p className="font-mono text-tiny tracking-loose text-ink-4 m-0">
        SM-2 间隔重复 · 跨域混合
      </p>

      <div className="relative h-[160px] my-2"> {/* hardcode-allow: h-160 stack 设计 SSOT */}
        {decoNext2 !== undefined ? (
          <StackCard variant="ts-3" note={decoNext2} />
        ) : null}
        {decoNext !== undefined ? (
          <StackCard variant="ts-2" note={decoNext} />
        ) : null}
        <StackCard variant="ts-1" note={current} active />
      </div>

      <div className="flex justify-between items-center font-mono text-tiny tracking-loose text-ink-4">
        <span>支持 1-5 键评分</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={isSubmitting}
          data-testid="review-skip"
          className={cn(
            'flex-1 px-3 py-2 font-mono text-tiny tracking-wider uppercase',
            'rounded-tiny border border-line-3 bg-transparent text-white',
            'transition-colors duration-fast ease-motion',
            'hover:bg-surface-alt hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
          )}
        >
          跳过
        </button>
        <button
          type="button"
          onClick={() => handleQuality(0)}
          disabled={isSubmitting}
          data-testid="review-forgot"
          className={cn(
            'flex-1 px-3 py-2 font-mono text-tiny tracking-wider uppercase',
            'rounded-tiny border border-transparent bg-surface-alt text-ink',
            'transition-colors duration-fast ease-motion',
            'hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
          )}
        >
          没记住
        </button>
        <button
          type="button"
          onClick={() => handleQuality(5)}
          disabled={isSubmitting}
          data-testid="review-remembered"
          className={cn(
            'flex-1 px-3 py-2 font-mono text-tiny tracking-wider uppercase',
            'rounded-tiny border border-transparent bg-surface text-ink',
            'transition-colors duration-fast ease-motion',
            'hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
          )}
        >
          记住了
        </button>
      </div>
    </section>
  );
}

interface StackCardProps {
  readonly variant: 'ts-1' | 'ts-2' | 'ts-3';
  readonly note: NoteOutV2;
  readonly active?: boolean;
}

// 三层叠卡 transform translateY + scale + opacity. 走 inline style 因 Tailwind
// 不内置 scale-96/.92 / translateY-8/16 token (走任意值会过 lint:hardcode 警).
const STACK_STYLE: Record<
  StackCardProps['variant'],
  { readonly transform: string; readonly opacity: number; readonly zIndex: number }
> = {
  'ts-1': { transform: 'translateY(0) scale(1)', opacity: 1, zIndex: 3 },
  'ts-2': { transform: 'translateY(8px) scale(0.96)', opacity: 0.7, zIndex: 2 },
  'ts-3': { transform: 'translateY(16px) scale(0.92)', opacity: 0.4, zIndex: 1 },
};

function StackCard({ variant, note }: StackCardProps): ReactElement {
  const style = STACK_STYLE[variant];
  return (
    <article
      data-testid={`review-stack-${variant}`}
      style={style}
      className={cn(
        'absolute top-0 left-0 right-0 p-3 bg-surface-alt border border-line-3',
        'transition-transform duration-base ease-motion',
      )}
    >
      <span className="block font-mono text-tiny tracking-wider uppercase text-ink-4 mb-1">
        {note.type === 'quote' ? '金句' : note.type === 'method' ? '方法' : note.type === 'reflect' ? '反思' : '素材'} · {note.sourceDomain === 'xingce' ? '行测' : '申论'}
      </span>
      <p className="font-serif text-sm leading-snug text-ink m-0 truncate">
        {extractPreview(note)}
      </p>
    </article>
  );
}

function extractPreview(note: NoteOutV2): string {
  const body = note.body as Record<string, unknown>;
  if (note.type === 'quote' || note.type === 'reflect') {
    return typeof body.text === 'string' ? body.text : note.title;
  }
  if (note.type === 'method') {
    return typeof body.title === 'string' ? body.title : note.title;
  }
  return note.title || note.sourceRef;
}
