// ScratchClip — a dropped MaterialClip rendered as a sticky-note card in the
// ScratchPad. Visually paper-3 with left accent bar + small mono source label
// at the bottom. Pin SVG sits in the top-left as the design "tape" anchor.
//
// Re-draggable: from ScratchPad to EditorPanel textarea (drop inserts the
// 《引文》[label] inline at caret). Carries the same EssayClipDragPayload
// that MaterialClip emits so ScratchPad/EditorPanel drop handlers don't need
// to special-case origin.
//
// Dumb component: no store. Parent ScratchPad supplies onRemove.

import { PinIcon } from '@sikao/ui/icons/PinIcon';
import { XCloseIcon } from '@sikao/ui/icons/XCloseIcon';
import {
  ESSAY_CLIP_MIME,
  type EssayClipDragPayload,
  type ScratchClip as ScratchClipModel,
} from './types';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

export interface ScratchClipProps {
  readonly clip: ScratchClipModel;
  readonly onRemove: (id: string) => void;
}

export function ScratchClip({ clip, onRemove }: ScratchClipProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const payload: EssayClipDragPayload = {
      clipId: clip.id,
      matId: clip.matId,
      start: clip.start,
      end: clip.end,
      text: clip.text,
      sourceLabel: clip.sourceLabel,
    };
    e.dataTransfer.setData('text/plain', `《${clip.text}》[${clip.sourceLabel}]`);
    e.dataTransfer.setData(ESSAY_CLIP_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

    // a11y: scratch card. 卡内已含删除 button (line 50-58 aria-label). 卡身 draggable
    // 是 mouse-only re-drag enhancement (回拖到 editor textarea), drag drop API 无
    // keyboard 等价 (Web 标准限制). SR 读卡片内容 + 删除 button 是完整入口.
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="scratch-clip"
      draggable
      onDragStart={handleDragStart}
      data-testid={`essay-scratch-clip-${clip.id}`}
    >
      <span className="scratch-clip__pin" aria-hidden="true">
        <PinIcon size={14} />
      </span>
      <button
        type="button"
        onClick={() => onRemove(clip.id)}
        aria-label={`${ESSAY_SIKAO_COPY.scratchClipDelete}：${clip.text.slice(0, 12)}`}
        className="absolute top-1 right-1 text-ink-4 hover:text-accent transition-colors duration-fast"
        data-testid={`essay-scratch-clip-remove-${clip.id}`}
      >
        <XCloseIcon size={12} />
      </button>
      <div
        className="font-serif text-ink"
        style={{ fontSize: 14, lineHeight: 1.6, paddingRight: 16 }} /* hardcode-allow: paddingRight matches close-btn slot */
      >
        {clip.text}
      </div>
      <div className="scratch-clip__src">{clip.sourceLabel}</div>
    </div>
  );
}
