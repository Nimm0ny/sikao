import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import EssayHistory from '../EssayHistory';

const RECORD = (id: number, status: 'pending' | 'completed' | 'failed', score: number | null = null) => ({
  id,
  questionId: 9000 + id,
  answerText: '我的回答',
  status,
  score,
  feedback: null,
  failureReason: status === 'failed' ? 'X' : null,
  createdAt: '2026-04-29T08:30:00Z',
  gradedAt: status === 'pending' ? null : '2026-04-29T08:30:30Z',
});

describe('EssayHistory', () => {
  it('列 record 行 (3 状态各一条)', async () => {
    server.use(
      http.get('/api/v2/essay/grades', () =>
        HttpResponse.json([
          RECORD(1, 'completed', 78.5),
          RECORD(2, 'pending'),
          RECORD(3, 'failed'),
        ]),
      ),
    );
    renderWithProviders(<EssayHistory />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-history-list')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('essay-history-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('essay-history-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('essay-history-row-3')).toBeInTheDocument();
    // completed 显示 score, pending/failed 不显
    expect(screen.getByTestId('essay-history-row-score-1')).toHaveTextContent('78.5');
    expect(screen.queryByTestId('essay-history-row-score-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('essay-history-row-score-3')).not.toBeInTheDocument();
  });

  it('空 list → empty state', async () => {
    server.use(
      http.get('/api/v2/essay/grades', () => HttpResponse.json([])),
    );
    renderWithProviders(<EssayHistory />);
    await waitFor(() =>
      expect(screen.getByText('还没有批改记录')).toBeInTheDocument(),
    );
  });

  it('HTTP error → retry button', async () => {
    server.use(
      http.get('/api/v2/essay/grades', () =>
        HttpResponse.json({ detail: 'x' }, { status: 500 }),
      ),
    );
    renderWithProviders(<EssayHistory />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-history-retry')).toBeInTheDocument(),
    );
  });

  it('30s 时间窗内的相邻 record 聚合显示 "整卷模考" hint (PR2 review P1 #2)', async () => {
    // 5 条 record 模拟整卷交卷 (Promise.allSettled 并发, createdAt 间隔 < 1s)
    // + 1 条独立单题练习 (3 小时前). UI 应出 1 个整卷 group + 1 个单题 group.
    const examTime = '2026-05-07T14:00:';
    const soloTime = '2026-05-07T11:00:00Z';
    server.use(
      http.get('/api/v2/essay/grades', () =>
        HttpResponse.json([
          { ...RECORD(5, 'completed', 80), createdAt: `${examTime}05Z` },
          { ...RECORD(4, 'completed', 70), createdAt: `${examTime}04Z` },
          { ...RECORD(3, 'completed', 75), createdAt: `${examTime}03Z` },
          { ...RECORD(2, 'completed', 85), createdAt: `${examTime}02Z` },
          { ...RECORD(1, 'completed', 90), createdAt: `${examTime}01Z` },
          { ...RECORD(99, 'completed', 60), createdAt: soloTime },
        ]),
      ),
    );
    renderWithProviders(<EssayHistory />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-history-list')).toBeInTheDocument(),
    );
    // 第 1 个 group 整卷 (5 题), 第 2 个 group 单题
    expect(screen.getByTestId('essay-history-group-exam-0')).toBeInTheDocument();
    expect(screen.getByTestId('essay-history-group-exam-0')).toHaveTextContent(
      '整卷模考 · 5 题',
    );
    expect(screen.getByTestId('essay-history-group-single-1')).toBeInTheDocument();
    // 单题 group 不显示"整卷模考"标签
    expect(screen.queryByText('整卷模考 · 1 题')).not.toBeInTheDocument();
  });
});
