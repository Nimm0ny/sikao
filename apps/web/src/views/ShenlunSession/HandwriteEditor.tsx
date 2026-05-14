import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import { COLS, ROWS_PER_PAGE, CELL } from '@sikao/answer-engine/grid-layout/gridLayout';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';

// ShenlunSession/HandwriteEditor (PR13 P3, 2026-05-13) — canvas 横格手写编辑器.
//
// Spec SSOT: docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §2.6
// + plan docs/plan/sikao-shenlun-dual-mode-pr13.md §6.
//
// 设计:
//   - 25×18 横格 (横线 only, NOT 田字格). 复用 gridLayout.ts 的 COLS/ROWS_PER_PAGE/
//     CELL 常量保持跨模块一致.
//   - devicePixelRatio HiDPI 支持 (canvas.width = clientWidth * dpr + ctx.scale).
//   - Pointer events 只接 pointerType === 'pen' && isPrimary === true (跟
//     useInputMode 的 pen detect 对齐). mouse / touch 直接忽略.
//   - rAF coalesce: 一帧内多个 pointermove → 收集到 ref 列表, requestAnimationFrame
//     callback 内一次性 lineTo + stroke. 避免每 move 都 sync render.
//   - Eraser: e.buttons === 32 (Apple Pencil 双击 / Surface side button) →
//     globalCompositeOperation = 'destination-out', 同样 stroke 路径擦除.
//   - OCR trigger: pointerup → onStrokeEnd?.(strokeCount), strokeCount 累积 (P4 wire).
//
// 不实现 (P4+ scope): 撤销 / 重做 / clear / pan / zoom.
//
// a11y: canvas role="img" + aria-label (中文 label 来自 ESSAY_SIKAO_COPY +
// questionLabel). 视觉 label 走上方 question stem header (大字), canvas 自身
// 不能 textarea 那样 aria-labelledby 绑可见节点 (img 节点的 a11y 模式不同).

export interface HandwriteEditorProps {
  readonly questionId: string;
  readonly questionLabel: string;
  readonly questionStem: string;
  readonly onStrokeEnd?: (strokeCount: number) => void;
  readonly className?: string;
}

interface StrokePoint {
  readonly x: number;
  readonly y: number;
  readonly erase: boolean;
}

const STROKE_WIDTH = 1.5;

export default function HandwriteEditor({
  questionId,
  questionLabel,
  questionStem,
  onStrokeEnd,
  className,
}: HandwriteEditorProps): ReactElement {
  const reactId = useId();
  const headerDomId = `shenlun-handwrite-stem-${questionId}-${reactId}`;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 累积 stroke count 跨 session (questionId 不变内持续累计). 切题时 shell
  // remount 组件, useRef 自动 reset.
  const strokeCountRef = useRef<number>(0);
  // 当前 stroke 是否进行中 (pointerdown 后 true, pointerup/cancel/leave 后 false).
  const drawingRef = useRef<boolean>(false);
  // rAF 收集的 move queue. 每帧 flush 后清空.
  const pendingMovesRef = useRef<StrokePoint[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<StrokePoint | null>(null);

  // 初始化 canvas: 处理 DPR 缩放 + 画横格 + 设置默认 strokeStyle.
  // 跟随 ResizeObserver 重画 (window resize / orientation change).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setupCanvas = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      // strokeStyle 走 currentColor — 用 getComputedStyle 读 canvas 自身 color
      // (canvas className=text-ink-2, getComputedStyle 一定返回 valid CSS color
      // 字符串, 不需要 fallback fail-safe). Canvas 2D API 不接受 'currentColor'
      // 关键字, 必须先 resolve 到具体值, 这是唯一直读 computed 的合法路径.
      ctx.strokeStyle = window.getComputedStyle(canvas).color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = STROKE_WIDTH;
      drawGrid(ctx, width, height);
    };

    setupCanvas();
    const observer = new ResizeObserver(() => setupCanvas());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const flushQueue = useCallback((): void => {
    rafIdRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const queue = pendingMovesRef.current;
    if (queue.length === 0) return;
    for (const pt of queue) {
      const prev = lastPointRef.current;
      if (!prev) {
        lastPointRef.current = pt;
        continue;
      }
      ctx.globalCompositeOperation = pt.erase ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPointRef.current = pt;
    }
    pendingMovesRef.current = [];
  }, []);

  const scheduleFlush = useCallback((): void => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(flushQueue);
  }, [flushQueue]);

  const isAcceptedPointer = (e: ReactPointerEvent<HTMLCanvasElement>): boolean => {
    return e.pointerType === 'pen' && e.isPrimary === true;
  };

  const localPoint = (e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): void => {
      if (!isAcceptedPointer(e)) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      const { x, y } = localPoint(e);
      const erase = e.buttons === 32;
      lastPointRef.current = { x, y, erase };
      // pointerdown 也算一笔 (dot stroke 支持). beginPath + moveTo 即可,
      // 不画线段 (move event 来后才连线).
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): void => {
      if (!drawingRef.current) return;
      if (!isAcceptedPointer(e)) return;
      const { x, y } = localPoint(e);
      const erase = e.buttons === 32;
      pendingMovesRef.current.push({ x, y, erase });
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const endStroke = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): void => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      // 刷掉 queue 里残余 move, 保证最后一段绘出.
      if (pendingMovesRef.current.length > 0) {
        flushQueue();
      }
      lastPointRef.current = null;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
      }
      strokeCountRef.current += 1;
      onStrokeEnd?.(strokeCountRef.current);
    },
    [flushQueue, onStrokeEnd],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): void => {
      endStroke(e);
    },
    [endStroke],
  );

  const handlePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): void => {
      endStroke(e);
    },
    [endStroke],
  );

  const handlePointerLeave = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): void => {
      endStroke(e);
    },
    [endStroke],
  );

  const showStem = questionStem.trim() !== '' && questionStem !== questionLabel;
  const ariaLabel = `${ESSAY_SIKAO_COPY.handwriteEditorAriaLabel} · ${questionLabel}`;

  return (
    <section
      data-testid="shenlun-handwrite-editor"
      data-question-id={questionId}
      className={cn('flex flex-col min-h-0 overflow-hidden', className)}
    >
      <header
        id={headerDomId}
        className="px-6 py-3 border-b border-line-1 shrink-0 bg-paper-1"
        data-testid="shenlun-handwrite-editor-header"
      >
        <h2
          className="font-serif text-ink"
          style={{ fontSize: 18, lineHeight: 1.4 }} /* hardcode-allow: spec §2.6 题号 18 介于 --t-h3 与 --t-body */
        >
          {questionLabel}
        </h2>
        {showStem ? (
          <p
            className="font-serif text-ink-2 mt-1"
            style={{ fontSize: 14, lineHeight: 1.6 }} /* hardcode-allow: --t-body 14 题干说明 */
          >
            {questionStem}
          </p>
        ) : null}
      </header>
      <div
        className="flex-1 min-h-0 overflow-auto px-6 py-5 bg-paper-1"
        data-testid="shenlun-handwrite-editor-surface"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={ariaLabel}
          data-testid="shenlun-handwrite-editor-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerLeave}
          className="block text-ink-2 touch-none"
          style={{
            width: COLS * CELL,
            height: ROWS_PER_PAGE * CELL,
          }}
        />
      </div>
    </section>
  );
}

// Draw horizontal ruled lines (横格纸): top + ROWS_PER_PAGE bottom lines per cell.
// 不画竖线 — 跟田字格不同, 横格纸是 ASCII handwriting paper 风格.
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; /* hardcode-allow: 横格线浅灰, design 选择不走 token (页面装饰非 brand 色) */
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS_PER_PAGE; r += 1) {
    const y = r * CELL + 0.5; // 0.5 offset 让 1px 线锐利
    if (y > height) break;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}
