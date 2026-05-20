// EditorPanel — right column. Renders the active question stem + word
// counter + CiteBar + textarea + bottom toolbar. Spec 04-essay.md: textarea
// accepts ESSAY_CLIP_MIME drops → inserts 《引文》[M2·段三] at caret + appends
// to citationsByQ.
//
// Smart-ish component (knows about the active question), but submit/save
// callbacks bubble up via props. EssayShellSikao owns the route plumbing.

import { useCallback, useMemo, useRef } from 'react';
import { IconBtn } from '@sikao/ui/ui/IconBtn';
import { NavCloseIcon } from '@sikao/ui/icons';
import { NoteCaptureLauncher } from '@/components/notes';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';
import { CiteBar } from './CiteBar';
import {
  ESSAY_CLIP_MIME,
  type EssayClipDragPayload,
  type Citation,
} from './types';
import { nextCiteId } from './lib/clipId';

interface Props {
  // Receives matId of the originating ScratchClip — parent can use it to
  // switch the active material and (post-MVP) scroll the clip into view.
  readonly onJumpToClip: (matId: string) => void;
}

function formatCiteInline(payload: EssayClipDragPayload): string {
  return `《${payload.text}》[${payload.sourceLabel}]`;
}

function parseClipPayload(
  e: React.DragEvent<HTMLTextAreaElement>,
): EssayClipDragPayload | null {
  const raw = e.dataTransfer.getData(ESSAY_CLIP_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'matId' in parsed &&
      'sourceLabel' in parsed &&
      'text' in parsed
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
          clipId: typeof p.clipId === 'string' ? p.clipId : undefined,
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
    throw new Error('EditorPanel: malformed essay-clip payload');
  }
}

export function EditorPanel({ onJumpToClip }: Props) {
  const paper = useExamSession((s) => s.paper);
  const currentQ = useExamSession((s) => s.currentQ);
  const textsByQ = useExamSession((s) => s.textsByQ);
  const setText = useExamSession((s) => s.setText);
  const citationsByQ = useExamSession((s) => s.citationsByQ);
  const addCitation = useExamSession((s) => s.addCitation);
  const removeCitation = useExamSession((s) => s.removeCitation);

  const taRef = useRef<HTMLTextAreaElement>(null);

  const text = textsByQ[currentQ] ?? '';
  const citations = citationsByQ[currentQ] ?? [];
  const wordCount = useMemo(() => bodyChars(text), [text]);

  const question = paper?.questions[currentQ];
  const minWords = question?.minWords;
  const maxWords = question?.maxWords;

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    if (
      e.dataTransfer.types.includes(ESSAY_CLIP_MIME) ||
      e.dataTransfer.types.includes('text/plain')
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      const ta = taRef.current;
      if (!ta) return;
      const payload = parseClipPayload(e);
      if (!payload) return;
      e.preventDefault();
      const insert = formatCiteInline(payload);
      // Insert at caret. textarea may not have focus at the moment of drop;
      // selectionStart still reflects last-known caret in jsdom + browsers.
      const start = ta.selectionStart ?? text.length;
      const end = ta.selectionEnd ?? text.length;
      const next = text.slice(0, start) + insert + text.slice(end);
      setText(currentQ, next);
      const cite: Citation = {
        id: nextCiteId(),
        clipId: payload.clipId,
        text: payload.text,
        sourceLabel: payload.sourceLabel,
        insertedAt: Date.now(),
      };
      addCitation(currentQ, cite);
      // Restore caret after the inserted run so the user can keep typing.
      requestAnimationFrame(() => {
        const taNow = taRef.current;
        if (!taNow) return;
        const caret = start + insert.length;
        taNow.selectionStart = caret;
        taNow.selectionEnd = caret;
        taNow.focus();
      });
    },
    [text, currentQ, setText, addCitation],
  );

  const handleJump = useCallback(
    (cite: Citation) => {
      const scratchClips = useExamSession.getState().scratchClips;
      const clip =
        cite.clipId !== undefined
          ? scratchClips.find((c) => c.id === cite.clipId)
          : // Historical citations created before clipId existed only have
            // text and sourceLabel, so keep the legacy lookup for old snapshots.
            scratchClips.find(
              (c) => c.sourceLabel === cite.sourceLabel && c.text === cite.text,
            );
      if (clip) {
        onJumpToClip(clip.matId);
      }
    },
    [onJumpToClip],
  );

  if (!question) return null;

  return (
    <section
      className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden"
      data-testid="essay-editor-panel"
    >
      <header className="px-5 py-3 border-b border-line shrink-0 bg-paper-3">
        <div className="flex items-center gap-2">
          <span className="text-tiny font-mono text-ink-4">
            {question.no}
          </span>
          <span className="text-tiny text-accent font-semibold">
            {question.kind}
          </span>
          <div className="flex-1" />
          <span
            className="font-mono text-sm tabular-nums text-ink-3"
            data-testid="essay-editor-panel-wordcount"
          >
            {wordCount}
            {maxWords ? ` / ${maxWords}` : minWords ? ` 字（≥${minWords}）` : ' 字'}
          </span>
        </div>
        <h3
          className="font-serif text-ink mt-1"
          style={{ fontSize: 18, lineHeight: 1.4 }} /* hardcode-allow: title size matches MaterialPanel */
        >
          {question.title}
        </h3>
        <div
          className="text-sm text-ink-3 mt-1 font-serif"
          style={{ lineHeight: 1.6 }}
        >
          {question.body}
        </div>
      </header>

      <CiteBar
        citations={citations}
        onJump={handleJump}
        onRemove={(id) => removeCitation(currentQ, id)}
      />

      <textarea
        id="essay-editor-panel-textarea"
        name="essay-editor-panel-textarea"
        ref={taRef}
        value={text}
        onChange={(e) => setText(currentQ, e.target.value)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        spellCheck={false}
        placeholder={ESSAY_SIKAO_COPY.typedEditorPlaceholder}
        aria-label={`作答：${question.title}`}
        data-testid="essay-editor-panel-textarea"
        className="flex-1 min-h-0 w-full px-6 py-5 font-serif text-ink bg-transparent outline-none resize-none"
        style={{
          fontSize: 'var(--read-fs, 17px)',
          lineHeight: 'var(--read-lh, 1.78)',
        }}
      />

      <footer className="px-4 py-2 border-t border-line bg-paper-3 flex items-center gap-2 shrink-0">
        <span className="text-tiny text-ink-4 font-mono">
          自动保存
        </span>
        <div className="flex-1" />
        {/* Wave 6E (2026-05-12): 跨域"添加到笔记本" 入口 — pre-fill 申论题
            作为 attached + question stem 作为 sourceQuote. */}
        <NoteCaptureLauncher
          target={{
            kind: 'essay_question',
            refId: question.backendId,
            sourceDomain: 'essay',
            sourceRef: `申论题 ${question.no} · ${question.title}`,
          }}
          sourceQuote={question.body || question.title}
          tooltip={ESSAY_SIKAO_COPY.editorAddToNotebook}
          testId="essay-editor-panel-capture"
        />
        <IconBtn
          aria-label="清空作答"
          onClick={() => setText(currentQ, '')}
          data-testid="essay-editor-panel-clear"
        >
          <NavCloseIcon size={14} />
        </IconBtn>
      </footer>
    </section>
  );
}
