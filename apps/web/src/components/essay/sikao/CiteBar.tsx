// CiteBar — horizontal pill row above the EditorPanel textarea showing
// citations the user has dropped into THIS question's draft. Click → scrolls
// the originating ScratchClip into view (callback supplied by EditorPanel).
//
// Spec 04-essay.md: cite-bar 显示已引用片段, 可点击跳回 ScratchPad.
//
// Dumb component: parent supplies citations + onJump + onRemove.

import { ToolEyeIcon } from '@sikao/ui/icons/ToolEyeIcon';
import { XCloseIcon } from '@sikao/ui/icons/XCloseIcon';
import type { Citation } from './types';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

export interface CiteBarProps {
  readonly citations: readonly Citation[];
  readonly onJump: (citation: Citation) => void;
  readonly onRemove: (citationId: string) => void;
}

export function CiteBar({ citations, onJump, onRemove }: CiteBarProps) {
  if (citations.length === 0) return null;
  return (
    <div className="essay-cite-bar" data-testid="essay-cite-bar">
      <span className="text-tiny text-ink-4 font-mono pr-2">
        已引用 {citations.length}
      </span>
      {citations.map((cite) => (
        <span
          key={cite.id}
          className="essay-cite-bar__chip"
          data-testid={`essay-cite-chip-${cite.id}`}
        >
          {/* svg-only-allow: cite source label is content navigation (M2·段三), not a tool button */}
          <button
            type="button"
            onClick={() => onJump(cite)}
            className="inline-flex items-center gap-1 cursor-pointer"
            aria-label={`${ESSAY_SIKAO_COPY.citeJumpToSource} ${cite.sourceLabel}`}
          >
            <ToolEyeIcon size={12} />
            {cite.sourceLabel}
          </button>
          <button
            type="button"
            onClick={() => onRemove(cite.id)}
            aria-label={`移除引用：${cite.sourceLabel}`}
            className="text-ink-3 hover:text-accent transition-colors duration-fast"
          >
            <XCloseIcon size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}
