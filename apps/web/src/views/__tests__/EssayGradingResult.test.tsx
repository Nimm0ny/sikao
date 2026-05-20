import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Routes, Route, useLocation } from 'react-router-dom';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import EssayGradingResult from '../EssayGradingResult';
import type { EssayFeedbackV2, EssayGradingV2 } from '@sikao/api-client/types/api';

const FEEDBACK: EssayFeedbackV2 = {
  overallScore: 78,
  dimensions: [
    { name: '论点', weight: 0.3, score: 8, comment: '论点鲜明' },
    { name: '材料', weight: 0.25, score: 7, comment: '引用得当' },
    { name: '语言', weight: 0.2, score: 6.5, comment: '语言流畅' },
    { name: '结构', weight: 0.15, score: 8, comment: '层次清晰' },
    { name: '字数', weight: 0.1, score: 10, comment: '符合' },
  ],
  strengths: ['论点清晰'],
  weaknesses: ['例证单薄'],
  suggestions: ['多用并列'],
  sampleAnswer: '示范答案正文...',
  suspicious: false,
};

const RECORD = (status: 'pending' | 'completed' | 'failed', overrides: Partial<EssayGradingV2> = {}): EssayGradingV2 => ({
  id: 42,
  questionId: 9001,
  answerText: '我的回答正文',
  status,
  score: status === 'completed' ? 78 : null,
  feedback: status === 'completed' ? FEEDBACK : null,
  failureReason: status === 'failed' ? 'LLM_PARSE_FAILED' : null,
  createdAt: new Date().toISOString(),
  gradedAt: status !== 'pending' ? new Date().toISOString() : null,
  ...overrides,
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

function renderAt(path: string) {
  return renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/essay/grades/:recordId" element={<EssayGradingResult />} />
        <Route path="/essay/specialty/:questionId" element={<div data-testid="essay-specialty-exam" />} />
      </Routes>
    </>,
    { initialEntries: [path] },
  );
}

describe('EssayGradingResult', () => {
  it('invalid recordId path → 显示 NotFound', () => {
    renderAt('/essay/grades/abc');
    expect(screen.getByText('record 链接无效.')).toBeInTheDocument();
    expect(screen.getByText('申论批改报告')).toBeInTheDocument();
  });

  it('completed status → 渲染批改报告 + 复盘列表 + 对照答案 + 动作区', async () => {
    let analyticsBody: { eventName: string; properties?: Record<string, string> } | null = null;
    server.use(
      http.post('/api/v2/analytics/event', async ({ request }) => {
        analyticsBody = (await request.json()) as {
          eventName: string;
          properties?: Record<string, string>;
        };
        return HttpResponse.json({ received: true }, { status: 202 });
      }),
      http.get('/api/v2/essay/grades/:id', () => HttpResponse.json(RECORD('completed'))),
    );
    renderAt('/essay/grades/42');
    await waitFor(() =>
      expect(screen.getByTestId('essay-grading-result-completed')).toBeInTheDocument(),
    );
    expect(screen.getByText('申论批改报告')).toBeInTheDocument();
    // QuestionBreakdown + EssayThinkBlock + SampleAnswerCard + ResultActions
    expect(screen.getByTestId('essay-result-hero')).toBeInTheDocument();
    expect(screen.getByTestId('qbreak')).toBeInTheDocument();
    expect(screen.getByTestId('essay-think-block')).toBeInTheDocument();
    expect(screen.getByTestId('essay-sample-answer-card')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grading-result-actions')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grading-result-practice-again')).toHaveTextContent('再练一次');
    expect(screen.getByTestId('essay-grading-result-print')).toHaveTextContent('打印报告');
    expect(screen.getByTestId('essay-grading-result-actions-back')).toHaveTextContent('返回我的申论');
    // 不暴露 LLM / Pro 等"机器在评分"暗示 (调性: 像图书馆同学批改).
    // 只要不出现 "LLM" / "智能评分" / "Pro" / "模型" 字样.
    expect(screen.queryByText(/LLM|智能评分|模型/i)).not.toBeInTheDocument();
    expect(analyticsBody).toEqual({
      eventName: 'essay_grading_viewed',
      sessionId: '42',
      properties: {
        recordId: '42',
        questionId: '9001',
        score: '78',
      },
    });
  });

  it('completed actions → 再练一次走 specialty 路由, 打印调用 window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    server.use(
      http.get('/api/v2/essay/grades/:id', () => HttpResponse.json(RECORD('completed'))),
    );
    const user = userEvent.setup();
    renderAt('/essay/grades/42');
    await waitFor(() =>
      expect(screen.getByTestId('essay-grading-result-actions')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('essay-grading-result-print'));
    expect(printSpy).toHaveBeenCalledOnce();

    await user.click(screen.getByTestId('essay-grading-result-practice-again'));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/essay/specialty/9001'),
    );
    printSpy.mockRestore();
  });

  it('failed status → 渲染批改失败文案且不暴露 raw failureReason', async () => {
    server.use(
      http.get('/api/v2/essay/grades/:id', () => HttpResponse.json(RECORD('failed'))),
    );
    renderAt('/essay/grades/42');
    await waitFor(() =>
      expect(screen.getByTestId('essay-grading-result-failed')).toBeInTheDocument(),
    );
    expect(screen.getByText('批改失败')).toBeInTheDocument();
    expect(screen.getByText('本次批改没有完成, 可重新提交一次.')).toBeInTheDocument();
    expect(screen.queryByText(/LLM_PARSE_FAILED|fallback/i)).not.toBeInTheDocument();
  });

  it('pending → 渲染 GradingPending; 后端切 completed → 自动切完成态 (轮询)', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/v2/essay/grades/:id', () => {
        callCount += 1;
        // 第 1 次 pending, 之后 completed (模拟批改完毕)
        return HttpResponse.json(callCount === 1 ? RECORD('pending') : RECORD('completed'));
      }),
    );
    renderAt('/essay/grades/42');
    // pending 先出现
    await waitFor(() =>
      expect(screen.getByTestId('essay-grading-result-pending')).toBeInTheDocument(),
    );
    // 1s 后 (refetchInterval) 切到 completed
    await waitFor(
      () => expect(screen.getByTestId('essay-grading-result-completed')).toBeInTheDocument(),
      { timeout: 3000 },
    );
    // pending 不再渲染
    expect(screen.queryByTestId('essay-grading-result-pending')).not.toBeInTheDocument();
  });

  it('failed → 重新提交 → 创新 record → 跳 /essay/grades/:newId', async () => {
    server.use(
      http.get('/api/v2/essay/grades/:id', ({ params }) => {
        if (params.id === '42') return HttpResponse.json(RECORD('failed'));
        return HttpResponse.json(RECORD('pending', { id: 99, questionId: 9001 }));
      }),
      http.post('/api/v2/essay/grade', () =>
        HttpResponse.json(RECORD('pending', { id: 99, questionId: 9001 })),
      ),
    );
    const user = userEvent.setup();
    renderAt('/essay/grades/42');
    await waitFor(() =>
      expect(screen.getByTestId('essay-grading-failed-retry')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('essay-grading-failed-retry'));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/essay/grades/99'),
    );
  });

  it('completed but feedback null → 异常占位 (backend bug 兜底)', async () => {
    server.use(
      http.get('/api/v2/essay/grades/:id', () =>
        HttpResponse.json(RECORD('completed', { feedback: null })),
      ),
    );
    renderAt('/essay/grades/42');
    await waitFor(() =>
      expect(screen.getByTestId('essay-grading-result-no-feedback')).toBeInTheDocument(),
    );
  });
});
