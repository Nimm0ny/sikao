// ScratchNote — free-form sticky note authored by the user (not derived from
// material highlights). Spec 04-essay.md: paper-3 底, contentEditable.
//
// Why contentEditable over textarea: spec calls out "便签" feel — irregular
// height, inline editing without textarea chrome. contentEditable supports
// IME composition for CJK without manual key handling. Plain text only —
// rich-text would expand store schema and clash with the serif/mono ScratchPad
// typography.
//
// Dumb component: parent ScratchPad supplies onChange / onRemove.

import { useEffect, useRef } from 'react';
import { XCloseIcon } from '@sikao/ui/icons/XCloseIcon';
import type { ScratchNote as ScratchNoteModel } from './types';

const PLACEHOLDER = '自由便签…';

export interface ScratchNoteProps {
  readonly note: ScratchNoteModel;
  readonly onChange: (id: string, body: string) => void;
  readonly onRemove: (id: string) => void;
}

export function ScratchNote({ note, onChange, onRemove }: ScratchNoteProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external body changes (e.g. snapshot rehydrate) into the
  // contentEditable, but skip the sync while the user is actively typing.
  // contentEditable + React state is racy; the guard prevents caret jumps.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el === document.activeElement) return;
    if (el.textContent !== note.body) {
      el.textContent = note.body;
    }
  }, [note.body]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    onChange(note.id, el.textContent ?? '');
  };

  return (
    <div className="scratch-note" data-testid={`essay-scratch-note-${note.id}`}>
      <button
        type="button"
        onClick={() => onRemove(note.id)}
        aria-label="删除便签"
        className="absolute top-1 right-1 text-ink-4 hover:text-accent transition-colors duration-fast"
        data-testid={`essay-scratch-note-remove-${note.id}`}
      >
        <XCloseIcon size={12} />
      </button>
      <div
        ref={ref}
        className="scratch-note__body"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={handleInput}
        data-placeholder={PLACEHOLDER}
        aria-label="便签内容"
        data-testid={`essay-scratch-note-body-${note.id}`}
      />
    </div>
  );
}
