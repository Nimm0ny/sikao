import { useState, type FormEvent } from 'react';
import { cn } from '@sikao/shared-utils';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { ActionPlusIcon } from '@sikao/ui/icons';
import { FbScratchClip } from './FbScratchClip';
import type { ScratchClip } from '@sikao/domain/answer-session/usePracticeStore';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// SIKAO Phase 3 (2026-05-09): right-rail scratch area.
//
// Design SSOT: docs/plan/sikao-xingce-phase3-core.md.
// Right rail keeps scratch notes as the stable upper affordance +
// Phase 3 right rail scratch column / scratch card.
//
// 渐进披露 (master 决策):
//   - answeredCount < 5: opacity:0 + pointer-events:none
//   - answeredCount >= 5: fade in (transition opacity 600ms ease-out)
//
// Empty copy stays restrained and describes the current scratch state.
//
// scratch col 永远 sticky top, 跟左栏长滚动并行. 1366 collapse 由父级 grid 控.
//
// Dumb by contract: 不读 store; clips / answeredCount / current question label
// 由 caller 注入. addClip / removeClip 抛 caller.

export interface FbScratchColProps {
  readonly clips: readonly ScratchClip[];
  readonly answeredCount: number;
  /** 当前可视题号 ("Q16") + 主题 (e.g. "数字推理") — 空状态文案用. */
  readonly currentQuestionLabel: string | null;
  readonly currentQuestionId: string | null;
  readonly onAddClip: (input: { qid: string; content: string; sourceLabel?: string }) => void;
  readonly onRemoveClip: (id: string) => void;
}

const PROGRESSIVE_DISCLOSURE_THRESHOLD = 5;

export function FbScratchCol({
  clips,
  answeredCount,
  currentQuestionLabel,
  currentQuestionId,
  onAddClip,
  onRemoveClip,
}: FbScratchColProps) {
  const showScratch = answeredCount >= PROGRESSIVE_DISCLOSURE_THRESHOLD;
  // Wave 9 Phase 2a (2026-05-12): tablet (md-lg) sticky top-16 (跟 mobile-style-guide §1.3
  // tablet 紧凑 hybrid); desktop top-20 跟 xl-laptop 维持 sticky 上沿 24px 留白.
  return (
    <aside
      className={cn(
        'sticky top-16 lg:top-20 self-start min-w-0 max-h-[calc(100vh-6rem)] flex flex-col gap-4',
        'transition-opacity duration-slow ease-motion',
      )}
      style={{ opacity: showScratch ? 1 : 0, pointerEvents: showScratch ? 'auto' : 'none' }}
      data-show={showScratch}
      data-testid="fb-scratch-col"
      aria-hidden={!showScratch}
    >
      <div className="flex items-center justify-between text-tiny font-mono tracking-eyebrow uppercase text-ink-3">
        <span>笔记 草稿</span>
        <span className="font-sans text-tiny tracking-loose text-ink-4">N 切换</span>
      </div>
      <div
        className={cn(
          'flex-1 min-h-[20rem] flex flex-col gap-3 p-4',
          'bg-paper-3 border border-line rounded-card',
        )}
      >
        <div className="font-serif text-base font-medium text-ink">
          {currentQuestionLabel !== null ? `本题 ${currentQuestionLabel}` : '本题草稿'}
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {clips.length === 0 ? (
            <FbScratchEmpty currentQuestionLabel={currentQuestionLabel} />
          ) : (
            clips.map((clip) => (
              <FbScratchClip key={clip.id} clip={clip} onRemove={onRemoveClip} />
            ))
          )}
        </div>
        <FbScratchAddForm
          currentQuestionId={currentQuestionId}
          currentQuestionLabel={currentQuestionLabel}
          onAddClip={onAddClip}
        />
      </div>
    </aside>
  );
}

interface FbScratchEmptyProps {
  readonly currentQuestionLabel: string | null;
}

function FbScratchEmpty({ currentQuestionLabel }: FbScratchEmptyProps) {
  // Copy stays neutral and only states the empty scratch state.
  const label = currentQuestionLabel ?? '本题';
  return (
    <div
      className="px-4 py-5 text-center font-sans text-sm text-ink-3 leading-relaxed border border-dashed border-line rounded-tiny"
      data-testid="fb-scratch-empty"
    >
      {label} 暂无便签。
      <br />
      {PRACTICE_COPY.fbScratchHint}。
    </div>
  );
}

interface FbScratchAddFormProps {
  readonly currentQuestionId: string | null;
  readonly currentQuestionLabel: string | null;
  readonly onAddClip: (input: { qid: string; content: string; sourceLabel?: string }) => void;
}

function FbScratchAddForm({
  currentQuestionId,
  currentQuestionLabel,
  onAddClip,
}: FbScratchAddFormProps) {
  const [draft, setDraft] = useState('');
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed === '' || currentQuestionId === null) return;
    onAddClip({
      qid: currentQuestionId,
      content: trimmed,
      sourceLabel: currentQuestionLabel ?? undefined,
    });
    setDraft('');
  };
  const disabled = currentQuestionId === null || draft.trim() === '';
  return (
    <form
      onSubmit={handleSubmit}
      className="mt-auto flex flex-col gap-2"
      data-testid="fb-scratch-add-form"
    >
      <textarea
        id="fb-scratch-add-input"
        name="scratchClip"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder={`${PRACTICE_COPY.fbScratchAdd}…`}
        aria-label={PRACTICE_COPY.fbScratchAriaLabel}
        className={cn(
          'w-full px-3 py-2 bg-surface border border-line rounded-tiny',
          'font-sans text-sm leading-relaxed text-ink placeholder:text-ink-4 resize-none',
          'focus-visible:outline-none focus-visible:border-ink',
        )}
        data-testid="fb-scratch-add-input"
      />
      <Tooltip label="添加便签">
        <IconBtn
          type="submit"
          size="sm"
          aria-label="添加便签"
          disabled={disabled}
          className="self-end"
          data-testid="fb-scratch-add-submit"
        >
          <ActionPlusIcon size={16} />
        </IconBtn>
      </Tooltip>
    </form>
  );
}
