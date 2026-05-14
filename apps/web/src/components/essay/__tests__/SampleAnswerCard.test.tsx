import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SampleAnswerCard } from '../SampleAnswerCard';

describe('SampleAnswerCard', () => {
  it('renders banner + body + word count when sampleAnswer non-empty', () => {
    const text = '这是示范答案, 共有若干字.';
    render(<SampleAnswerCard sampleAnswer={text} />);
    expect(screen.getByTestId('essay-sample-answer-card')).toBeInTheDocument();
    expect(screen.getByTestId('essay-sample-answer-banner')).toHaveTextContent(
      '仅供对照, 非官方参考答案',
    );
    expect(screen.getByTestId('essay-sample-answer-body')).toHaveTextContent(text);
    // 字数 = text.length (含中英标点)
    expect(screen.getByText(`${text.length} 字`)).toBeInTheDocument();
  });

  it('renders nothing when sampleAnswer is null', () => {
    const { container } = render(<SampleAnswerCard sampleAnswer={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when sampleAnswer is whitespace-only', () => {
    // JSX prop string literal 不解析 escape, 用 expression 把真换行/空格传进
    const { container } = render(<SampleAnswerCard sampleAnswer={'   \n\t  '} />);
    expect(container.firstChild).toBeNull();
  });

  it('preserves whitespace and newlines in body (whitespace-pre-wrap)', () => {
    const text = '第一段\n\n第二段';
    render(<SampleAnswerCard sampleAnswer={text} />);
    const body = screen.getByTestId('essay-sample-answer-body');
    expect(body).toHaveClass('whitespace-pre-wrap');
    // textContent strips visual whitespace but keeps the literal
    expect(body.textContent).toBe(text);
  });
});
