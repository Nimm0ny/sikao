// MaterialClip — a draggable highlight phrase rendered inline inside the
// MaterialPanel reader. Spec 04-essay.md: ".hl draggable=true" + ⋮⋮ grip
// hint at left edge.
//
// Why a span with `draggable`: spec calls for inline drag from the source
// passage. Wrapping each highlight range with a draggable span keeps it
// inline (no layout shift on hover) and lets `dataTransfer` carry both the
// fallback text and the structured EssayClipDragPayload.
//
// Dumb component: no store, no router. The parent MaterialPanel slices the
// material body into ranges and renders one MaterialClip per range.

import type { ReactNode } from 'react';
import { GripVerticalIcon } from '@sikao/ui/icons/GripVerticalIcon';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import {
  ESSAY_CLIP_MIME,
  type EssayClipDragPayload,
} from './types';

export interface MaterialClipProps {
  readonly matId: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly sourceLabel: string; // pre-computed by parent (e.g. "M2·段三")
  readonly kind?: 'underline' | 'highlight';
  readonly children?: ReactNode;
}

export function MaterialClip({
  matId,
  start,
  end,
  text,
  sourceLabel,
  kind = 'highlight',
  children,
}: MaterialClipProps) {
  const handleDragStart = (e: React.DragEvent<HTMLSpanElement>) => {
    const payload: EssayClipDragPayload = {
      matId,
      start,
      end,
      text,
      sourceLabel,
    };
    // text/plain is the fallback for any drop target that doesn't speak
    // the custom MIME (e.g. native browser controls). Format mirrors the
    // existing HighlightRail behaviour: 「<text>」 with corner brackets.
    e.dataTransfer.setData('text/plain', `「${text}」`);
    e.dataTransfer.setData(ESSAY_CLIP_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <Tooltip label={`${sourceLabel} · 拖到草稿或编辑器`}>
    {/* a11y: inline draggable phrase 内嵌 reader 段落, drag 是 mouse-only enhancement,
        SR / keyboard 用户从右侧 HighlightRail (已带 role=button + Enter handler) 操作.
        给 span 加 role=button 会让 SR 把每段 reading 念成 button, 破坏阅读流, 不可取. */}
    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
    <span
      className="essay-hl-clip"
      draggable
      onDragStart={handleDragStart}
      data-testid={`essay-material-clip-${matId}-${start}`}
      data-source-label={sourceLabel}
      data-kind={kind}
    >
      <span
        aria-hidden="true"
        className="absolute -left-4 top-1/2 -translate-y-1/2 text-ink-4 opacity-60"
        style={{
          /* hardcode-allow: grip is a visual hint anchor, sub-token offset */
          width: 12,
          height: 12,
        }}
      >
        <GripVerticalIcon size={12} />
      </span>
      {children ?? text}
    </span>
    </Tooltip>
  );
}
