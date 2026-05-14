import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { EssayShellSikao } from '../EssayShellSikao';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ESSAY_CLIP_MIME, type EssayClipDragPayload } from '@sikao/domain/shenlun/types';
import { __resetClipIdCounter } from '../lib/clipId';
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
    {
      no: '第二题',
      kind: '对策',
      title: '提出对策',
      body: '请提出对策。',
      minWords: 200,
      maxWords: 300,
      durationSec: 1200,
      requirements: ['可行'],
      refMaterials: ['m2'],
      backendId: 1002,
      fullScore: 15,
    },
  ],
  materials: [
    { id: 'm1', title: '资料一', subtitle: '', body: '材料一正文。' },
    { id: 'm2', title: '资料二', subtitle: '', body: '材料二正文。' },
  ],
};

const samplePayload: EssayClipDragPayload = {
  matId: 'm1',
  start: 0,
  end: 5,
  text: '材料一正文',
  sourceLabel: 'M1·段一',
};

beforeEach(() => {
  __resetClipIdCounter();
  act(() => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().start(); // skip prestart modal
  });
});

describe('EssayShellSikao integration', () => {
  it('renders Topbar + EssayGrid + ScratchPad + EditorPanel + MmStrip', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(screen.getByTestId('essay-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grid')).toBeInTheDocument();
    expect(screen.getByTestId('essay-scratch-pad')).toBeInTheDocument();
    expect(screen.getByTestId('essay-editor-panel')).toBeInTheDocument();
    // MmStrip on both sides because paper has 2 materials + 2 questions
    expect(screen.getByTestId('essay-mm-strip-l')).toBeInTheDocument();
    expect(screen.getByTestId('essay-mm-strip-r')).toBeInTheDocument();
  });

  it('full drag flow: material highlight → ScratchPad → EditorPanel cite', () => {
    // Pre-seed a highlight so MaterialClip exists in the DOM. Real flow goes
    // through MaterialReader's mark mode; we shortcut here.
    act(() => {
      useExamSession.setState({
        highlights: { m1: [{ start: 0, end: 5 }] },
      });
    });

    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);

    // Step 1: drag the MaterialClip onto the ScratchPad
    const pad = screen.getByTestId('essay-scratch-pad');
    const store = new Map<string, string>();
    store.set(ESSAY_CLIP_MIME, JSON.stringify(samplePayload));
    fireEvent.drop(pad, {
      dataTransfer: {
        types: Array.from(store.keys()),
        getData: (t: string) => store.get(t) ?? '',
        dropEffect: 'none',
      },
    });
    expect(useExamSession.getState().scratchClips).toHaveLength(1);

    // Step 2: drag the same payload into the editor textarea
    const ta = screen.getByTestId('essay-editor-panel-textarea') as HTMLTextAreaElement;
    fireEvent.drop(ta, {
      dataTransfer: {
        types: Array.from(store.keys()),
        getData: (t: string) => store.get(t) ?? '',
        dropEffect: 'none',
      },
    });
    const text = useExamSession.getState().textsByQ[0];
    expect(text).toContain('《材料一正文》[M1·段一]');
    expect(useExamSession.getState().citationsByQ[0]).toHaveLength(1);
  });

  it('switch question via MmStrip Q tab', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    fireEvent.click(screen.getByLabelText('第 2 题'));
    expect(useExamSession.getState().currentQ).toBe(1);
    // Editor stem updates to the new question
    expect(screen.getByText('提出对策')).toBeInTheDocument();
  });

  it('switch material via MmStrip M tab', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    fireEvent.click(screen.getByLabelText('材料 2'));
    expect(useExamSession.getState().matIdx).toBe(1);
    expect(screen.getByText('资料二')).toBeInTheDocument();
  });

  it('topbar submit opens SubmitDialog', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    fireEvent.click(screen.getByTestId('essay-topbar-submit'));
    // SubmitDialog renders an aria-modal
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('topbar pause toggles phase', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(useExamSession.getState().phase).toBe('running');
    fireEvent.click(screen.getByTestId('essay-topbar-pause'));
    expect(useExamSession.getState().phase).toBe('paused');
    fireEvent.click(screen.getByTestId('essay-topbar-pause'));
    expect(useExamSession.getState().phase).toBe('running');
  });

  it('focus mode toggle hides ScratchPad and flips aria-label / aria-pressed', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);

    // Default: ScratchPad rendered, focus button labelled "专注大作文",
    // aria-pressed=false, shell carries data-focus-mode="off".
    expect(screen.getByTestId('essay-scratch-pad')).toBeInTheDocument();
    const btn = screen.getByTestId('essay-topbar-focus');
    expect(btn).toHaveAttribute('aria-label', '专注大作文');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('essay-shell-sikao')).toHaveAttribute(
      'data-focus-mode',
      'off',
    );

    // Click → ScratchPad gone, label flips to "退出专注模式", pressed=true.
    fireEvent.click(btn);
    expect(screen.queryByTestId('essay-scratch-pad')).not.toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label', '退出专注模式');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('essay-shell-sikao')).toHaveAttribute(
      'data-focus-mode',
      'on',
    );

    // Click again → restored.
    fireEvent.click(btn);
    expect(screen.getByTestId('essay-scratch-pad')).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label', '专注大作文');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides MmStrip in single-q mode with a single q+single m', () => {
    act(() => {
      useExamSession.getState().hydrate({
        ...mockPaper,
        questions: [mockPaper.questions[0]],
        materials: [mockPaper.materials[0]],
      });
      useExamSession.getState().start();
    });
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(screen.queryByTestId('essay-mm-strip-l')).not.toBeInTheDocument();
    expect(screen.queryByTestId('essay-mm-strip-r')).not.toBeInTheDocument();
  });
});
