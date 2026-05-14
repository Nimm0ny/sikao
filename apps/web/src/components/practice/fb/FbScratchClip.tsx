import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { XCloseIcon } from '@sikao/ui/icons';
import type { ScratchClip } from '@sikao/domain/answer-session/usePracticeStore';

// SIKAO Phase 3 (2026-05-09): 单条 scratch 笔记 chip.
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md.
//
// 视觉:
//   - paper bg + rule border + radius chip
//   - sourceLabel 是 "M1" / "Q16" 这类来源 (反衬 ink 黑底 mono)
//   - 删除 IconBtn 右上 (跟 SIKAO components.md icon-btn 系统一致)
//
// Dumb by contract: caller 控 onRemove.

export interface FbScratchClipProps {
  readonly clip: ScratchClip;
  readonly onRemove: (id: string) => void;
}

export function FbScratchClip({ clip, onRemove }: FbScratchClipProps) {
  return (
    <div
      className="group relative p-3 bg-surface border border-line rounded-tiny"
      data-testid={`fb-scratch-clip-${clip.id}`}
    >
      <div className="flex items-baseline gap-2 pr-7">
        {clip.sourceLabel !== undefined && clip.sourceLabel !== '' ? (
          <span
            className={
              'inline-block px-2 py-1 bg-ink text-white font-mono text-tiny tracking-loose rounded-tiny shrink-0'
            }
          >
            {clip.sourceLabel}
          </span>
        ) : null}
        <p className="font-serif text-sm leading-relaxed text-ink break-words">
          {clip.content}
        </p>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-fast">
        <Tooltip label="删除">
          <IconBtn
            size="sm"
            aria-label="删除便签"
            onClick={() => onRemove(clip.id)}
            data-testid={`fb-scratch-clip-remove-${clip.id}`}
          >
            <XCloseIcon size={14} />
          </IconBtn>
        </Tooltip>
      </div>
    </div>
  );
}
