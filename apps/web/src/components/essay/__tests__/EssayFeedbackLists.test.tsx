import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EssayFeedbackLists } from '../EssayFeedbackLists';

describe('EssayFeedbackLists', () => {
  it('renders 3 sections with their items when all non-empty', () => {
    render(
      <EssayFeedbackLists
        strengths={['论点清晰']}
        weaknesses={['例证单薄', '层次不分']}
        suggestions={['多用并列结构']}
      />,
    );
    expect(screen.getByTestId('essay-feedback-lists')).toBeInTheDocument();
    expect(screen.getByTestId('essay-strengths-title')).toHaveTextContent('优点');
    expect(screen.getByTestId('essay-weaknesses-title')).toHaveTextContent('问题');
    expect(screen.getByTestId('essay-suggestions-title')).toHaveTextContent('建议');
    expect(screen.getByText('论点清晰')).toBeInTheDocument();
    expect(screen.getByText('例证单薄')).toBeInTheDocument();
    expect(screen.getByText('层次不分')).toBeInTheDocument();
    expect(screen.getByText('多用并列结构')).toBeInTheDocument();
  });

  it('omits a section whose items array is empty', () => {
    render(
      <EssayFeedbackLists
        strengths={['唯一一条']}
        weaknesses={[]}
        suggestions={[]}
      />,
    );
    expect(screen.getByTestId('essay-strengths-title')).toBeInTheDocument();
    expect(screen.queryByTestId('essay-weaknesses-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('essay-suggestions-title')).not.toBeInTheDocument();
  });

  it('returns null when all 3 lists empty (no <div data-testid> in DOM)', () => {
    const { container } = render(
      <EssayFeedbackLists strengths={[]} weaknesses={[]} suggestions={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('sections render in fixed order: strengths → weaknesses → suggestions', () => {
    render(
      <EssayFeedbackLists
        strengths={['s1']}
        weaknesses={['w1']}
        suggestions={['g1']}
      />,
    );
    const titles = screen.getAllByText(/优点|问题|建议/);
    expect(titles[0]).toHaveTextContent('优点');
    expect(titles[1]).toHaveTextContent('问题');
    expect(titles[2]).toHaveTextContent('建议');
  });
});
