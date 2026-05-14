import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EssayHistoryRow } from '../EssayHistoryRow';
import type { EssayGradingV2 } from '@sikao/api-client/types/api';

function makeRecord(overrides: Partial<EssayGradingV2> = {}): EssayGradingV2 {
  return {
    id: 42,
    questionId: 9001,
    answerText: '我的回答',
    status: 'completed',
    score: 78.5,
    feedback: null,
    failureReason: null,
    createdAt: '2026-04-29T08:30:00Z',
    gradedAt: '2026-04-29T08:30:30Z',
    ...overrides,
  };
}

function renderRow(record: EssayGradingV2) {
  return render(
    <MemoryRouter>
      <EssayHistoryRow record={record} />
    </MemoryRouter>,
  );
}

describe('EssayHistoryRow', () => {
  it('renders completed: success badge + score + question id + link to /essay/grades/{id}', () => {
    renderRow(makeRecord());
    const link = screen.getByTestId('essay-history-row-42');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/essay/grades/42');
    expect(link).toHaveTextContent('已完成');
    expect(link).toHaveTextContent('题 #9001');
    expect(screen.getByTestId('essay-history-row-score-42')).toHaveTextContent('78.5');
  });

  it('renders pending: neutral badge, no score', () => {
    renderRow(makeRecord({ status: 'pending', score: null, gradedAt: null }));
    const link = screen.getByTestId('essay-history-row-42');
    expect(link).toHaveTextContent('批改中');
    expect(screen.queryByTestId('essay-history-row-score-42')).not.toBeInTheDocument();
  });

  it('renders failed: danger badge, no score even if score is non-null defensively', () => {
    renderRow(makeRecord({ status: 'failed', score: null, failureReason: 'X' }));
    const link = screen.getByTestId('essay-history-row-42');
    expect(link).toHaveTextContent('失败');
    expect(screen.queryByTestId('essay-history-row-score-42')).not.toBeInTheDocument();
  });

  it('formats createdAt as YYYY-MM-DD HH:mm in local time', () => {
    // 2026-04-29 08:30 UTC. 本地时区取决环境, 但格式必须 YYYY-MM-DD HH:mm.
    renderRow(makeRecord());
    const link = screen.getByTestId('essay-history-row-42');
    expect(link.textContent).toMatch(/2026-04-29 \d{2}:\d{2}/);
  });

  it('falls back to raw ISO if createdAt unparseable (defensive)', () => {
    renderRow(makeRecord({ createdAt: 'not-a-date' }));
    const link = screen.getByTestId('essay-history-row-42');
    expect(link).toHaveTextContent('not-a-date');
  });
});
