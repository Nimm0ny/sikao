import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { DraftPaperModal } from '../DraftPaperModal';
import type { Paper } from '@sikao/domain/shenlun/types';

const mockPaper: Paper = {
  id: 'p1',
  code: 'p1-code',
  name: '测试套卷',
  questions: [
    {
      no: '第一题',
      kind: '概括',
      title: '概括问题',
      body: '请概括 X。',
      minWords: 100,
      maxWords: 200,
      durationSec: 600,
      requirements: ['条理清晰'],
      refMaterials: ['m1'],
      backendId: 1001,
      fullScore: 10,
    },
  ],
  materials: [{ id: 'm1', title: '资料一', subtitle: '', body: '材料一正文。' }],
};

beforeEach(() => {
  act(() => useExamSession.getState().hydrate(mockPaper));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DraftPaperModal', () => {
  it('binds draft textarea to the existing scratch store', () => {
    render(<DraftPaperModal open onClose={vi.fn()} />);
    const textarea = screen.getByTestId('essay-draft-paper-textarea');
    fireEvent.change(textarea, { target: { value: '分论点\n例子' } });
    expect(useExamSession.getState().scratch).toBe('分论点\n例子');
  });

  it('calls onClose from the footer action', () => {
    const onClose = vi.fn();
    render(<DraftPaperModal open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('essay-draft-paper-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches to draw mode and clears the canvas context', () => {
    const clearRect = vi.fn();
    const canvasContext = {
      clearRect,
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,drawn',
    );

    render(<DraftPaperModal open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('essay-draft-paper-draw-mode'));

    const canvas = screen.getByTestId('essay-draft-paper-canvas');
    fireEvent.pointerDown(canvas, { clientX: 12, clientY: 14 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 24 });
    fireEvent.pointerUp(canvas);
    fireEvent.click(screen.getByTestId('essay-draft-paper-clear'));

    expect(canvasContext.beginPath).toHaveBeenCalled();
    expect(canvasContext.moveTo).toHaveBeenCalled();
    expect(canvasContext.lineTo).toHaveBeenCalled();
    expect(canvasContext.stroke).toHaveBeenCalled();
    expect(clearRect).toHaveBeenCalled();
  });

  it('keeps hand-drawn canvas pixels after closing and reopening the modal', () => {
    const drawImage = vi.fn();
    const canvasContext = {
      clearRect: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage,
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,drawn',
    );
    class InstantImage {
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', InstantImage);

    const { rerender } = render(<DraftPaperModal open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('essay-draft-paper-draw-mode'));

    const canvas = screen.getByTestId('essay-draft-paper-canvas');
    fireEvent.pointerDown(canvas, { clientX: 12, clientY: 14 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 24 });
    fireEvent.pointerUp(canvas);

    rerender(<DraftPaperModal open={false} onClose={vi.fn()} />);
    rerender(<DraftPaperModal open onClose={vi.fn()} />);

    expect(drawImage).toHaveBeenCalled();
  });
});
