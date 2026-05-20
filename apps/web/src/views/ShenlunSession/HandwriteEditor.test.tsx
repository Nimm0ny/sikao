import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import HandwriteEditor from './HandwriteEditor';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

//
// 覆盖:
//   - 渲染 required props 不崩 + canvas role="img" + aria-label 含 questionLabel
//   - questionLabel header 大字渲染
//   - pointerType==='pen' && isPrimary=true 才接 stroke (mouse/touch 忽略)
//   - pointerup → onStrokeEnd 调起且 strokeCount 递增
//   - mouse pointerdown 不触发 onStrokeEnd
//   - eraser buttons===32 → ctx.globalCompositeOperation 切 destination-out
//
// 不覆盖 (jsdom 局限 / 后续 phase):
//   - 实际 stroke 路径绘制 (canvas pixel buffer 不可比对; chrome MCP 后期验收)
//   - rAF coalesce timing (vi.useFakeTimers 跟 ResizeObserver mock 复杂, 留 review)
//   - devicePixelRatio HiDPI 缩放数值校验 (read-only behavior, 真机验收)

// canvas 2d context mock (jsdom HTMLCanvasElement.getContext 默认 return null).
// 这里 mock 一个最小可用 ctx, 让组件 setupCanvas + draw 路径不崩.
interface MockCtx {
  fillStyle: string;
  strokeStyle: string;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  globalCompositeOperation: GlobalCompositeOperation;
  setTransform: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
}

function makeMockCtx(): MockCtx {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    globalCompositeOperation: 'source-over',
    setTransform: vi.fn(),
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    fillRect: vi.fn(),
  };
}

let mockCtx: MockCtx;

beforeEach(() => {
  mockCtx = makeMockCtx();
  // jsdom 默认对 canvas.getContext / pointerCapture API 抛 "Not implemented",
  // 用 Object.defineProperty 在 HTMLCanvasElement.prototype 上替换 (spyOn 找不到
  // 不存在的属性会 throw). configurable=true 让 afterEach 可清理.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => mockCtx as unknown as CanvasRenderingContext2D,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    writable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
    configurable: true,
    writable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', {
    configurable: true,
    writable: true,
    value: () => true,
  });
  // ResizeObserver 在 jsdom 未实现 — 给个最小 mock.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(() => {
  // 清理 defineProperty 注入的 stub. Object.defineProperty with configurable=true
  // 支持 delete; 让 jsdom 还原 "Not implemented" 默认 (vitest 测试隔离需要).
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext;
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).setPointerCapture;
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).releasePointerCapture;
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).hasPointerCapture;
  vi.unstubAllGlobals();
});

interface BuildPropsOverrides {
  readonly questionId?: string;
  readonly questionLabel?: string;
  readonly questionStem?: string;
  readonly onStrokeEnd?: (count: number) => void;
}

function buildProps(overrides: BuildPropsOverrides = {}) {
  return {
    questionId: overrides.questionId ?? 'q3',
    questionLabel: overrides.questionLabel ?? '题目三',
    questionStem: overrides.questionStem ?? '题目三',
    onStrokeEnd: overrides.onStrokeEnd,
  };
}

function fireCanvasPointer(
  canvas: HTMLElement,
  kind: 'down' | 'move' | 'up',
  overrides: Partial<{
    pointerType: string;
    isPrimary: boolean;
    buttons: number;
    clientX: number;
    clientY: number;
    pointerId: number;
  }> = {},
): void {
  const init = {
    pointerType: overrides.pointerType ?? 'pen',
    isPrimary: overrides.isPrimary ?? true,
    buttons: overrides.buttons ?? 1,
    clientX: overrides.clientX ?? 50,
    clientY: overrides.clientY ?? 50,
    pointerId: overrides.pointerId ?? 1,
    bubbles: true,
  };
  const map = { down: 'pointerDown', move: 'pointerMove', up: 'pointerUp' } as const;
  fireEvent[map[kind]](canvas, init);
}

describe('HandwriteEditor', () => {
  it('renders without crashing with required props', () => {
    renderWithProviders(<HandwriteEditor {...buildProps()} />);
    expect(screen.getByTestId('shenlun-handwrite-editor')).toBeInTheDocument();
  });

  it('renders canvas with role=img and aria-label containing questionLabel', () => {
    renderWithProviders(
      <HandwriteEditor {...buildProps({ questionLabel: '题目三' })} />,
    );
    const canvas = screen.getByTestId('shenlun-handwrite-editor-canvas');
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas.getAttribute('role')).toBe('img');
    const ariaLabel = canvas.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain(ESSAY_SIKAO_COPY.handwriteEditorAriaLabel);
    expect(ariaLabel).toContain('题目三');
  });

  it('renders question label as visible heading above canvas', () => {
    renderWithProviders(
      <HandwriteEditor {...buildProps({ questionLabel: '题目三' })} />,
    );
    expect(screen.getByRole('heading', { level: 2, name: '题目三' })).toBeInTheDocument();
  });

  it('accepts pen + isPrimary pointer events and fires onStrokeEnd on pointerup', () => {
    const onStrokeEnd = vi.fn();
    renderWithProviders(<HandwriteEditor {...buildProps({ onStrokeEnd })} />);
    const canvas = screen.getByTestId('shenlun-handwrite-editor-canvas');
    fireCanvasPointer(canvas, 'down', { pointerType: 'pen', isPrimary: true });
    fireCanvasPointer(canvas, 'up', { pointerType: 'pen', isPrimary: true });
    expect(onStrokeEnd).toHaveBeenCalledTimes(1);
    expect(onStrokeEnd).toHaveBeenCalledWith(1);
  });

  it('ignores mouse pointer events (pointerType !== pen)', () => {
    const onStrokeEnd = vi.fn();
    renderWithProviders(<HandwriteEditor {...buildProps({ onStrokeEnd })} />);
    const canvas = screen.getByTestId('shenlun-handwrite-editor-canvas');
    fireCanvasPointer(canvas, 'down', { pointerType: 'mouse', isPrimary: true });
    fireCanvasPointer(canvas, 'up', { pointerType: 'mouse', isPrimary: true });
    expect(onStrokeEnd).not.toHaveBeenCalled();
  });

  it('ignores non-primary pen pointers (e.g. secondary stylus)', () => {
    const onStrokeEnd = vi.fn();
    renderWithProviders(<HandwriteEditor {...buildProps({ onStrokeEnd })} />);
    const canvas = screen.getByTestId('shenlun-handwrite-editor-canvas');
    fireCanvasPointer(canvas, 'down', { pointerType: 'pen', isPrimary: false });
    fireCanvasPointer(canvas, 'up', { pointerType: 'pen', isPrimary: false });
    expect(onStrokeEnd).not.toHaveBeenCalled();
  });

  it('increments strokeCount across multiple strokes', () => {
    const onStrokeEnd = vi.fn();
    renderWithProviders(<HandwriteEditor {...buildProps({ onStrokeEnd })} />);
    const canvas = screen.getByTestId('shenlun-handwrite-editor-canvas');
    fireCanvasPointer(canvas, 'down');
    fireCanvasPointer(canvas, 'up');
    fireCanvasPointer(canvas, 'down');
    fireCanvasPointer(canvas, 'up');
    fireCanvasPointer(canvas, 'down');
    fireCanvasPointer(canvas, 'up');
    expect(onStrokeEnd).toHaveBeenCalledTimes(3);
    expect(onStrokeEnd).toHaveBeenLastCalledWith(3);
  });

  it('switches ctx.globalCompositeOperation to destination-out when buttons===32 (eraser)', () => {
    renderWithProviders(<HandwriteEditor {...buildProps()} />);
    const canvas = screen.getByTestId('shenlun-handwrite-editor-canvas');
    fireCanvasPointer(canvas, 'down', { buttons: 32 });
    expect(mockCtx.globalCompositeOperation).toBe('destination-out');
  });
});
