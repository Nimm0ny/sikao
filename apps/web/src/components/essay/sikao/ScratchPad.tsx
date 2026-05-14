// ScratchPad — left-bottom panel that catches MaterialClip drops and renders
// the resulting ScratchClip stack on a ruled paper-2 background. Spec 04-
// essay.md: 横线纸 (28px gradient), clip + free note appended top-to-bottom
// in drop order, dashed accent outline while dropping.
//
// Drop contract:
//   - Accepts dataTransfer with ESSAY_CLIP_MIME (preferred) or text/plain
//     (fallback for native clips). Foreign drops without either are ignored.
//   - On drop: adds one ScratchClip via store action. Dedupe by source range
//     (matId + start + end) — the SAME phrase dragged twice won't pile up.
//
// Reads the store directly (it's a panel, not a leaf primitive) for clips,
// notes, and the add/remove actions.

import { useCallback, useState } from 'react';
import { ActionPlusIcon } from '@sikao/ui/icons/ActionPlusIcon';
import { ScratchIcon } from '@sikao/ui/icons/ScratchIcon';
import { IconBtn } from '@sikao/ui/ui/IconBtn';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ScratchClip as ScratchClipCard } from './ScratchClip';
import { ScratchNote as ScratchNoteCard } from './ScratchNote';
import { DropMarker } from './DropMarker';
import {
  ESSAY_CLIP_MIME,
  type EssayClipDragPayload,
  type ScratchClip as ScratchClipModel,
  type ScratchNote as ScratchNoteModel,
} from './types';
import { nextClipId, nextNoteId } from './lib/clipId';

function parsePayload(e: React.DragEvent<HTMLDivElement>): EssayClipDragPayload | null {
  const raw = e.dataTransfer.getData(ESSAY_CLIP_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'matId' in parsed &&
      'start' in parsed &&
      'end' in parsed &&
      'text' in parsed &&
      'sourceLabel' in parsed
    ) {
      const p = parsed as Record<string, unknown>;
      if (
        typeof p.matId === 'string' &&
        typeof p.start === 'number' &&
        typeof p.end === 'number' &&
        typeof p.text === 'string' &&
        typeof p.sourceLabel === 'string'
      ) {
        return {
          matId: p.matId,
          start: p.start,
          end: p.end,
          text: p.text,
          sourceLabel: p.sourceLabel,
        };
      }
    }
    return null;
  } catch {
    // The MIME we own — if the payload is malformed, surface a hard fail in
    // dev so the producer side gets fixed. Caller can swallow with try/catch
    // if needed, but ScratchPad won't silently accept garbage.
    throw new Error('ScratchPad: malformed essay-clip payload');
  }
}

export function ScratchPad() {
  const scratchClips = useExamSession((s) => s.scratchClips);
  const scratchNotes = useExamSession((s) => s.scratchNotes);
  const addScratchClip = useExamSession((s) => s.addScratchClip);
  const removeScratchClip = useExamSession((s) => s.removeScratchClip);
  const addScratchNote = useExamSession((s) => s.addScratchNote);
  const updateScratchNote = useExamSession((s) => s.updateScratchNote);
  const removeScratchNote = useExamSession((s) => s.removeScratchNote);

  const [dropping, setDropping] = useState(false);

  const accepts = useCallback((e: React.DragEvent<HTMLDivElement>): boolean => {
    return (
      e.dataTransfer.types.includes(ESSAY_CLIP_MIME) ||
      e.dataTransfer.types.includes('text/plain')
    );
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!accepts(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!dropping) setDropping(true);
    },
    [accepts, dropping],
  );

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only flip dropping false when leaving the actual container — children
    // bubbling dragLeave shouldn't kill the outline.
    if (e.currentTarget === e.target) setDropping(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!accepts(e)) return;
      e.preventDefault();
      setDropping(false);
      const payload = parsePayload(e);
      if (payload) {
        // Dedupe: same range from same material → no-op
        const dup = scratchClips.some(
          (c) =>
            c.matId === payload.matId &&
            c.start === payload.start &&
            c.end === payload.end,
        );
        if (dup) return;
        const clip: ScratchClipModel = {
          id: nextClipId(),
          matId: payload.matId,
          start: payload.start,
          end: payload.end,
          text: payload.text,
          sourceLabel: payload.sourceLabel,
          position: scratchClips.length,
          addedAt: Date.now(),
        };
        addScratchClip(clip);
      }
      // text/plain-only drops are silently dropped here (no clip added) —
      // they belong in the EditorPanel cite flow, not the ScratchPad.
    },
    [accepts, scratchClips, addScratchClip],
  );

  const handleAddNote = useCallback(() => {
    const note: ScratchNoteModel = {
      id: nextNoteId(),
      body: '',
      position: scratchNotes.length,
      addedAt: Date.now(),
    };
    addScratchNote(note);
  }, [addScratchNote, scratchNotes.length]);

  const totalItems = scratchClips.length + scratchNotes.length;

  return (
    // a11y: drag-drop target panel. aside 是 landmark, drag/drop API 无 keyboard
    // 等价 (Web 标准). 子 button (line 168 IconBtn + clip remove button) 提供
    // keyboard-accessible 入口. drag 是 mouse-only enhancement.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      className="scratch-pad scratch-paper flex flex-col min-h-0 border border-line rounded-card"
      data-testid="essay-scratch-pad"
      data-dropping={dropping ? 'true' : 'false'}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        <ScratchIcon size={14} className="text-accent" />
        <span className="text-sm font-semibold text-ink tracking-wide">草稿纸</span>
        <span className="text-tiny text-ink-4">
          拖入材料短语 · 全题共享
        </span>
        <div className="flex-1" />
        <Tooltip label="添加自由便签" side="bottom">
          <IconBtn
            type="button"
            size="sm"
            aria-label="添加自由便签"
            onClick={handleAddNote}
            data-testid="essay-scratch-pad-add-note"
          >
            <ActionPlusIcon size={16} />
          </IconBtn>
        </Tooltip>
      </header>

      <div
        className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
        data-testid="essay-scratch-pad-body"
      >
        <DropMarker />
        {totalItems === 0 ? (
          <div className="text-tiny text-ink-4 text-center px-2 py-8 leading-relaxed">
            从左侧材料拖入划线短语<br />或点击「+ 自由便签」添加便签
          </div>
        ) : (
          <>
            {scratchClips.map((clip) => (
              <ScratchClipCard
                key={clip.id}
                clip={clip}
                onRemove={removeScratchClip}
              />
            ))}
            {scratchNotes.map((note) => (
              <ScratchNoteCard
                key={note.id}
                note={note}
                onChange={updateScratchNote}
                onRemove={removeScratchNote}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
