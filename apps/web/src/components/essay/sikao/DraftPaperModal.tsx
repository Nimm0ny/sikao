import { useEffect, useRef, useState } from 'react';
import { Button } from '@sikao/ui/ui';
import { FormatUnderlineIcon, NavCloseIcon, ToolScratchIcon, TrashIcon } from '@sikao/ui/icons';
import { scratchChars } from '@sikao/answer-engine/word-limit/bodyChars';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy/essay-sikao';

export interface DraftPaperModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function DraftPaperModal({ open, onClose }: DraftPaperModalProps) {
  const scratch = useExamSession((s) => s.scratch);
  const setScratch = useExamSession((s) => s.setScratch);
  const [mode, setMode] = useState<'write' | 'draw'>('write');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const drawingSnapshotRef = useRef<string | null>(null);
  const count = scratchChars(scratch);

  const snapshotCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingSnapshotRef.current = canvas.toDataURL('image/png');
  };

  const readCanvasStrokeColor = () => {
    const tokenColor = window.getComputedStyle(document.documentElement).getPropertyValue('--ink-1').trim();
    if (tokenColor.length > 0) return tokenColor;
    return window.getComputedStyle(document.body).color;
  };

  useEffect(() => {
    if (!open || mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = readCanvasStrokeColor();
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    const snapshot = drawingSnapshotRef.current;
    if (!snapshot) return;
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, width, height);
    };
    image.src = snapshot;
  }, [mode, open]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    const point = canvasPoint(event);
    ctx?.beginPath();
    ctx?.moveTo(point.x, point.y);
  };

  const moveDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const point = canvasPoint(event);
    ctx?.lineTo(point.x, point.y);
    ctx?.stroke();
  };

  const endDraw = () => {
    drawingRef.current = false;
    snapshotCanvas();
  };

  const clear = () => {
    if (mode === 'write') {
      setScratch('');
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingSnapshotRef.current = null;
  };

  if (!open) return null;

  const switchMode = (nextMode: 'write' | 'draw') => {
    if (mode === 'draw' && nextMode === 'write') snapshotCanvas();
    setMode(nextMode);
  };

  const close = () => {
    if (mode === 'draw') snapshotCanvas();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-modal bg-black/30 backdrop-blur-sm flex items-center justify-center p-8"
      role="presentation"
      data-testid="essay-draft-paper-modal"
    >
      <div
        className="w-[920px] max-w-[95vw] h-[640px] max-h-[90vh] bg-paper-1 rounded-card-lg shadow-pop flex flex-col overflow-hidden border border-line"
        role="dialog"
        aria-modal="true"
        aria-label={ESSAY_SIKAO_COPY.draftTitle}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-paper-1">
          <div className="flex items-center gap-2">
            <ToolScratchIcon size={18} className="text-ink-2" />
            <div>
              <div className="font-serif text-h3 text-ink">{ESSAY_SIKAO_COPY.draftTitle}</div>
              <div className="text-tiny font-mono text-ink-3">
                {ESSAY_SIKAO_COPY.draftDescription}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="mr-2 flex rounded-tiny border border-line bg-paper-2 p-1">
              <button
                type="button"
                onClick={() => switchMode('write')}
                className="px-3 h-7 rounded-1 text-meta data-[active=true]:bg-paper-1 data-[active=true]:text-ink data-[active=false]:text-ink-3"
                data-active={mode === 'write'}
                data-testid="essay-draft-paper-write-mode"
              >
                {ESSAY_SIKAO_COPY.draftWriteMode}
              </button>
              <button
                type="button"
                onClick={() => switchMode('draw')}
                className="px-3 h-7 rounded-1 text-meta data-[active=true]:bg-paper-1 data-[active=true]:text-ink data-[active=false]:text-ink-3"
                data-active={mode === 'draw'}
                data-testid="essay-draft-paper-draw-mode"
              >
                {ESSAY_SIKAO_COPY.draftDrawMode}
              </button>
            </div>
            {/* svg-only-allow: modal draft clear keeps visible label inside dialog header */}
            <button
              type="button"
              onClick={clear}
              className="flex h-8 items-center gap-1 rounded-tiny border border-line px-3 text-meta text-ink-2 hover:border-ink-1"
              aria-label={ESSAY_SIKAO_COPY.draftClear}
              data-testid="essay-draft-paper-clear"
            >
              <TrashIcon size={14} />
              {ESSAY_SIKAO_COPY.draftClear}
            </button>
            <button
              type="button"
              onClick={close}
              className="h-8 w-8 rounded-tiny hover:bg-paper-2 flex items-center justify-center text-ink-2"
              aria-label={ESSAY_SIKAO_COPY.draftClose}
              data-testid="essay-draft-paper-close-icon"
            >
              <NavCloseIcon size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-paper-2 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(var(--line-1) 1px, transparent 1px), linear-gradient(90deg, var(--line-1) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              opacity: 0.6,
            }}
          />
          {mode === 'write' ? (
            <textarea
              id="essay-draft-paper-textarea"
              name="essayDraft"
              value={scratch}
              onChange={(event) => setScratch(event.target.value)}
              placeholder={ESSAY_SIKAO_COPY.draftPlaceholder}
              aria-label={ESSAY_SIKAO_COPY.draftTitle}
              data-testid="essay-draft-paper-textarea"
              className="relative w-full h-full p-6 bg-transparent outline-none resize-none font-serif text-ink"
              style={{ fontSize: 15, lineHeight: 1.9 }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              className="relative w-full h-full cursor-crosshair"
              aria-label={ESSAY_SIKAO_COPY.draftDrawArea}
              data-testid="essay-draft-paper-canvas"
            />
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-line bg-paper-1">
          <div className="text-tiny font-mono text-ink-3 flex items-center gap-2">
            <FormatUnderlineIcon size={14} />
            <span>{ESSAY_SIKAO_COPY.draftFooterHint}</span>
            <span className="tabular-nums">{count} 字</span>
          </div>
          <Button
            variant="secondary"
            onClick={close}
            data-testid="essay-draft-paper-close"
          >
            {ESSAY_SIKAO_COPY.draftClose}
          </Button>
        </div>
      </div>
    </div>
  );
}
