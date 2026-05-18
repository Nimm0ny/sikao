import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { AnswerSheetPanel } from '../AnswerSheetPanel';
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
      refMaterials: ['m1'],
      backendId: 1002,
      fullScore: 15,
    },
  ],
  materials: [{ id: 'm1', title: '资料一', subtitle: '', body: '材料一正文。' }],
};

beforeEach(() => {
  act(() => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().start();
  });
});

describe('AnswerSheetPanel', () => {
  it('captures textarea input and renders grid characters with count', () => {
    render(<AnswerSheetPanel />);
    const textarea = screen.getByTestId('essay-answer-sheet-input');
    fireEvent.change(textarea, { target: { value: '第一行\n第二行' } });

    expect(useExamSession.getState().textsByQ[0]).toBe('第一行\n第二行');
    expect(screen.getByTestId('essay-answer-sheet-wordcount')).toHaveTextContent('6 / 200');
    expect(screen.getAllByText('第')).toHaveLength(2);
    expect(screen.getByText('二')).toBeInTheDocument();
  });

  it('renders caret coordinates from textarea selection', () => {
    render(<AnswerSheetPanel />);
    const textarea = screen.getByTestId('essay-answer-sheet-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'abc\n中文' } });
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;
    fireEvent.select(textarea);

    const caret = screen.getByTestId('essay-answer-sheet-caret');
    expect(caret).toHaveAttribute('data-row', '1');
    expect(caret).toHaveAttribute('data-col', '1');
  });

  it('keeps answers isolated per question when switching questions', () => {
    render(<AnswerSheetPanel />);
    const textarea = screen.getByTestId('essay-answer-sheet-input');
    fireEvent.change(textarea, { target: { value: '第一题答案' } });

    act(() => useExamSession.getState().setCurrentQ(1));
    fireEvent.change(screen.getByTestId('essay-answer-sheet-input'), {
      target: { value: '第二题答案' },
    });

    expect(useExamSession.getState().textsByQ).toEqual(['第一题答案', '第二题答案']);
  });
});
