import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { EditorPanel } from '../EditorPanel';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ESSAY_CLIP_MIME, type EssayClipDragPayload } from '@sikao/domain/shenlun/types';
import { __resetClipIdCounter } from '../lib/clipId';
import type { Paper } from '@sikao/domain/shenlun/types';

const mockPaper: Paper = {
  id: 'p1',
  code: 'p1-code',
  name: 'Test Paper',
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
  materials: [{ id: 'm1', title: 'M1', subtitle: '资料一', body: '材料一正文。' }],
};

const samplePayload: EssayClipDragPayload = {
  matId: 'm1',
  start: 0,
  end: 4,
  text: '材料一正文',
  sourceLabel: 'M1·段一',
};

beforeEach(() => {
  __resetClipIdCounter();
  act(() => {
    useExamSession.getState().hydrate(mockPaper);
  });
});

describe('EditorPanel', () => {
  it('renders question stem + word count', () => {
    render(<EditorPanel onJumpToClip={vi.fn()} />);
    expect(screen.getByText('概括问题')).toBeInTheDocument();
    expect(screen.getByTestId('essay-editor-panel-wordcount')).toHaveTextContent(
      '0 / 200',
    );
  });

  it('updates word count as text changes', () => {
    render(<EditorPanel onJumpToClip={vi.fn()} />);
    const ta = screen.getByTestId('essay-editor-panel-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '今天天气不错' } });
    expect(screen.getByTestId('essay-editor-panel-wordcount')).toHaveTextContent(
      /6 \/ 200/,
    );
  });

  it('drop on textarea inserts inline cite + adds to citations', () => {
    render(<EditorPanel onJumpToClip={vi.fn()} />);
    const ta = screen.getByTestId('essay-editor-panel-textarea') as HTMLTextAreaElement;
    // Set caret at position 2 (between '前文' and '……')
    fireEvent.change(ta, { target: { value: '前文……' } });
    ta.selectionStart = 2;
    ta.selectionEnd = 2;
    const store = new Map<string, string>();
    store.set(ESSAY_CLIP_MIME, JSON.stringify(samplePayload));
    fireEvent.drop(ta, {
      dataTransfer: {
        types: Array.from(store.keys()),
        getData: (t: string) => store.get(t) ?? '',
        dropEffect: 'none',
      },
    });
    const expected = '前文' + '《材料一正文》[M1·段一]' + '……';
    expect(useExamSession.getState().textsByQ[0]).toBe(expected);
    const cites = useExamSession.getState().citationsByQ[0];
    expect(cites).toHaveLength(1);
    expect(cites[0].sourceLabel).toBe('M1·段一');
  });

  it('drop preserves scratch clip id on the new citation', () => {
    render(<EditorPanel onJumpToClip={vi.fn()} />);
    const ta = screen.getByTestId('essay-editor-panel-textarea') as HTMLTextAreaElement;
    const store = new Map<string, string>();
    store.set(
      ESSAY_CLIP_MIME,
      JSON.stringify({
        ...samplePayload,
        clipId: 'clip-1',
      }),
    );
    fireEvent.drop(ta, {
      dataTransfer: {
        types: Array.from(store.keys()),
        getData: (t: string) => store.get(t) ?? '',
        dropEffect: 'none',
      },
    });

    const cites = useExamSession.getState().citationsByQ[0];
    expect(cites).toHaveLength(1);
    expect(cites[0].clipId).toBe('clip-1');
  });

  it('renders cite-bar chip after drop', () => {
    render(<EditorPanel onJumpToClip={vi.fn()} />);
    const ta = screen.getByTestId('essay-editor-panel-textarea') as HTMLTextAreaElement;
    const store = new Map<string, string>();
    store.set(ESSAY_CLIP_MIME, JSON.stringify(samplePayload));
    fireEvent.drop(ta, {
      dataTransfer: {
        types: Array.from(store.keys()),
        getData: (t: string) => store.get(t) ?? '',
        dropEffect: 'none',
      },
    });
    expect(screen.getByTestId('essay-cite-bar')).toBeInTheDocument();
    // The label appears as a button inside the chip
    expect(screen.getByLabelText('跳到引用源 M1·段一')).toBeInTheDocument();
  });

  it('cite-bar onJump calls onJumpToClip when matching clip exists', () => {
    act(() => {
      useExamSession.setState({
        scratchClips: [
          {
            id: 'clip-1',
            matId: 'm1',
            start: 0,
            end: 4,
            text: '材料一正文',
            sourceLabel: 'M1·段一',
            position: 0,
            addedAt: 0,
          },
        ],
        citationsByQ: [
          [
            {
              id: 'cite-1',
              text: '材料一正文',
              sourceLabel: 'M1·段一',
              insertedAt: 0,
            },
          ],
        ],
      });
    });
    const onJumpToClip = vi.fn();
    render(<EditorPanel onJumpToClip={onJumpToClip} />);
    fireEvent.click(screen.getByLabelText('跳到引用源 M1·段一'));
    expect(onJumpToClip).toHaveBeenCalledWith('m1');
  });

  it('cite-bar onJump prefers clipId over matching text and source label', () => {
    act(() => {
      useExamSession.setState({
        scratchClips: [
          {
            id: 'clip-older',
            matId: 'm1',
            start: 0,
            end: 4,
            text: '材料一正文',
            sourceLabel: 'M1·段一',
            position: 0,
            addedAt: 0,
          },
          {
            id: 'clip-target',
            matId: 'm2',
            start: 4,
            end: 8,
            text: '材料一正文',
            sourceLabel: 'M1·段一',
            position: 1,
            addedAt: 1,
          },
        ],
        citationsByQ: [
          [
            {
              id: 'cite-1',
              clipId: 'clip-target',
              text: '材料一正文',
              sourceLabel: 'M1·段一',
              insertedAt: 0,
            },
          ],
        ],
      });
    });
    const onJumpToClip = vi.fn();
    render(<EditorPanel onJumpToClip={onJumpToClip} />);
    fireEvent.click(screen.getByLabelText('跳到引用源 M1·段一'));
    expect(onJumpToClip).toHaveBeenCalledWith('m2');
  });

  it('cite-bar onJump does not fallback by text when citation has a missing clipId', () => {
    act(() => {
      useExamSession.setState({
        scratchClips: [
          {
            id: 'clip-other',
            matId: 'm1',
            start: 0,
            end: 4,
            text: '材料一正文',
            sourceLabel: 'M1·段一',
            position: 0,
            addedAt: 0,
          },
        ],
        citationsByQ: [
          [
            {
              id: 'cite-1',
              clipId: 'clip-missing',
              text: '材料一正文',
              sourceLabel: 'M1·段一',
              insertedAt: 0,
            },
          ],
        ],
      });
    });
    const onJumpToClip = vi.fn();
    render(<EditorPanel onJumpToClip={onJumpToClip} />);
    fireEvent.click(screen.getByLabelText('跳到引用源 M1·段一'));
    expect(onJumpToClip).not.toHaveBeenCalled();
  });

  it('clear button empties the answer', () => {
    render(<EditorPanel onJumpToClip={vi.fn()} />);
    const ta = screen.getByTestId('essay-editor-panel-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '一二三' } });
    fireEvent.click(screen.getByTestId('essay-editor-panel-clear'));
    expect(useExamSession.getState().textsByQ[0]).toBe('');
  });
});
