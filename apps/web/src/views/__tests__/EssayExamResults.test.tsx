import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Routes, Route, useLocation } from 'react-router-dom';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import EssayExamResults from '../EssayExamResults';
import type { EssayFeedbackV2, EssayGradingV2 } from '@sikao/api-client/types/api';

// PR2 — 整卷模考成绩单. URL: /essay/exam/results?paperCode&ids&total
//
// 5 个 case (review §5 PR2):
//   - URL 无 ids / 非数 → 链接无效占位
//   - 全 pending → 进度 0/N, 加权得分占位 "无法计算"
//   - 部分 completed → 进度 M/N, 加权得分按 fullScore 计算 (review P0 #8)
//   - 全 completed (大作文崩 → 60 分, 不是 1/N 平均的 80 分)
//   - failed retry → 创新 record, ids URL 中对应位置被替换 (替换的不是 NaN)

const FEEDBACK = (overall: number, dimensionScore: number): EssayFeedbackV2 => ({
  overallScore: overall,
  dimensions: [
    { name: '论点', weight: 0.3, score: dimensionScore, comment: '论点鲜明' },
    { name: '材料', weight: 0.25, score: dimensionScore, comment: '引用得当' },
    { name: '语言', weight: 0.2, score: dimensionScore, comment: '语言流畅' },
    { name: '结构', weight: 0.15, score: dimensionScore, comment: '层次清晰' },
    { name: '字数', weight: 0.1, score: dimensionScore, comment: '符合' },
  ],
  strengths: ['论点清晰'],
  weaknesses: ['例证单薄'],
  suggestions: ['多用并列'],
  sampleAnswer: '示范答案正文...',
  suspicious: false,
});

interface RecordOverrides {
  readonly id?: number;
  readonly questionId?: number;
  readonly score?: number;
  readonly feedback?: EssayFeedbackV2 | null;
}

const RECORD = (
  status: 'pending' | 'completed' | 'failed',
  overrides: RecordOverrides = {},
): EssayGradingV2 => ({
  id: overrides.id ?? 1,
  questionId: overrides.questionId ?? 9001,
  answerText: '我的回答正文',
  status,
  score: status === 'completed' ? (overrides.score ?? 80) : null,
  feedback:
    overrides.feedback !== undefined
      ? overrides.feedback
      : status === 'completed'
      ? FEEDBACK(overrides.score ?? 80, 8)
      : null,
  failureReason: status === 'failed' ? 'LLM_PARSE_FAILED' : null,
  createdAt: new Date().toISOString(),
  gradedAt: status !== 'pending' ? new Date().toISOString() : null,
});

// fullScore 配比 (跟 essayExamMock 对齐): 概括 10 / 对策 15 / 分析 20 /
// 应用文 15 / 大作文 40 = 100. 用来测加权得分 (P0 #8 防 1/N 误算).
const FULLSCORE_BY_QID: Record<number, number> = {
  101: 10,
  102: 15,
  103: 20,
  104: 15,
  105: 40,
};

function makePaperQuestionsResponse(): unknown {
  return Object.entries(FULLSCORE_BY_QID).map(([qid, fs]) => ({
    id: Number(qid),
    position: Object.keys(FULLSCORE_BY_QID).indexOf(qid) + 1,
    rendererKey: 'essay',
    stemText: '<p>题干</p>',
    explanationText: '<p>要求</p>',
    content: { essayMetadata: { fullScore: fs } },
  }));
}

function LocationProbe() {
  const loc = useLocation();
  return (
    <div data-testid="location">{`${loc.pathname}${loc.search}`}</div>
  );
}

function renderAt(search: string) {
  return renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/essay/exam/results" element={<EssayExamResults />} />
      </Routes>
    </>,
    { initialEntries: [`/essay/exam/results${search}`] },
  );
}

describe('EssayExamResults', () => {
  it('URL 缺 ids → 链接无效占位 + 返回我的申论 CTA', () => {
    renderAt('?paperCode=AIPTA-2024-01&total=5');
    expect(screen.getByText('链接无效')).toBeInTheDocument();
    expect(
      screen.getByTestId('essay-exam-results-back-empty'),
    ).toBeInTheDocument();
  });

  it('URL ids 全非数 → 同样链接无效 (不静默渲染 0 张卡)', () => {
    renderAt('?ids=abc,def&total=5');
    expect(screen.getByText('链接无效')).toBeInTheDocument();
  });

  it('URL 缺 total → 链接无效 (review P1 #4 不 silent fallback 隐藏 partialMissing)', () => {
    renderAt('?paperCode=AIPTA-2024-01&ids=1,2,3');
    expect(screen.getByText('链接无效')).toBeInTheDocument();
  });

  it('URL 中间题空答案 (ids=1,,3,,5&total=5) → SkippedQuestionCard 占位, PositionLabel 不错位', async () => {
    // review P0 #9 — 中间题空答案不应让后续题号紧凑 / 错位.
    // ids "1,,3,,5" 意思: 第 1/3/5 题有 record, 第 2/4 题用户跳过.
    server.use(
      http.get('/api/v2/essay/grades/:id', ({ params }) => {
        const id = Number(params.id);
        return HttpResponse.json(
          RECORD('completed', { id, questionId: 100 + id, score: 80 }),
        );
      }),
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json(makePaperQuestionsResponse()),
      ),
    );
    renderAt('?paperCode=AIPTA-2024-01&ids=1,,3,,5&total=5');

    await waitFor(() =>
      expect(screen.getByTestId('essay-exam-results-list')).toBeInTheDocument(),
    );
    // 第 1, 3, 5 题渲染成 completed/pending 卡 (id 不为 null)
    await waitFor(() =>
      expect(
        screen.getByTestId('essay-exam-results-completed-1'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId('essay-exam-results-completed-3')).toBeInTheDocument();
    expect(screen.getByTestId('essay-exam-results-completed-5')).toBeInTheDocument();
    // 第 2, 4 题渲染成 SkippedQuestionCard (idx 1 / 3, 因 0-indexed)
    expect(screen.getByTestId('essay-exam-results-skipped-1')).toBeInTheDocument();
    expect(screen.getByTestId('essay-exam-results-skipped-3')).toBeInTheDocument();
    // partial hint: 5 题中 3 题进入评分
    expect(
      screen.getByTestId('essay-exam-results-missing-hint'),
    ).toHaveTextContent('5 题');
    expect(
      screen.getByTestId('essay-exam-results-missing-hint'),
    ).toHaveTextContent('3 题');
  });

  it('全 pending → 进度 0 完成, 加权得分占位 "无法计算"', async () => {
    server.use(
      http.get('/api/v2/essay/grades/:id', ({ params }) =>
        HttpResponse.json(RECORD('pending', { id: Number(params.id), questionId: 101 })),
      ),
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json(makePaperQuestionsResponse()),
      ),
    );
    renderAt('?paperCode=AIPTA-2024-01&ids=1,2&total=5');

    await waitFor(() =>
      expect(screen.getByTestId('essay-exam-results-list')).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId('essay-exam-results-weighted-pending'),
    ).toBeInTheDocument();
    // partial submit hint (5 题中 2 题进入)
    expect(
      screen.getByTestId('essay-exam-results-missing-hint'),
    ).toHaveTextContent('5 题');
    expect(
      screen.getByTestId('essay-exam-results-progress'),
    ).toHaveTextContent('0 / 2');
  });

  it('全 completed 大作文崩 → 加权 60.0 (而非 1/N 平均的 80.0)', async () => {
    // 5 题 fullScore [10, 15, 20, 15, 40], 用户 [100%, 100%, 100%, 100%, 0%]
    // 真实加权 = (10+15+20+15+0) / 100 * 100 = 60
    // 错误 1/N = (100+100+100+100+0)/5 = 80
    const ids = [1, 2, 3, 4, 5];
    const qIds = [101, 102, 103, 104, 105];
    const scores = [100, 100, 100, 100, 0];
    server.use(
      http.get('/api/v2/essay/grades/:id', ({ params }) => {
        const idx = ids.indexOf(Number(params.id));
        return HttpResponse.json(
          RECORD('completed', {
            id: ids[idx],
            questionId: qIds[idx],
            score: scores[idx],
            feedback: FEEDBACK(scores[idx], scores[idx] / 10),
          }),
        );
      }),
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json(makePaperQuestionsResponse()),
      ),
    );
    renderAt('?paperCode=AIPTA-2024-01&ids=1,2,3,4,5&total=5');

    await waitFor(() =>
      expect(
        screen.getByTestId('essay-exam-results-weighted-total'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId('essay-exam-results-weighted-total'),
    ).toHaveTextContent('60.0');
    expect(
      screen.getByTestId('essay-exam-results-progress'),
    ).toHaveTextContent('5 / 5');
    // 5 张 completed 卡都渲染
    for (const id of ids) {
      expect(
        screen.getByTestId(`essay-exam-results-completed-${id}`),
      ).toBeInTheDocument();
    }
    // partial hint 不显示 (5/5 全提交)
    expect(
      screen.queryByTestId('essay-exam-results-missing-hint'),
    ).not.toBeInTheDocument();
  });

  it('部分 completed → 加权按已完成题计算 (其他还在 pending)', async () => {
    // ids 5 个, 前 3 个 completed, 后 2 个 pending
    // 已完成: q101 fs=10 score=80 → 8 分; q102 fs=15 score=60 → 9; q103 fs=20 score=40 → 8
    // 加权 = (8+9+8) / (10+15+20) * 100 = 25/45*100 ≈ 55.6
    server.use(
      http.get('/api/v2/essay/grades/:id', ({ params }) => {
        const id = Number(params.id);
        if (id === 1) return HttpResponse.json(RECORD('completed', { id: 1, questionId: 101, score: 80 }));
        if (id === 2) return HttpResponse.json(RECORD('completed', { id: 2, questionId: 102, score: 60 }));
        if (id === 3) return HttpResponse.json(RECORD('completed', { id: 3, questionId: 103, score: 40 }));
        return HttpResponse.json(RECORD('pending', { id, questionId: 100 + id }));
      }),
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json(makePaperQuestionsResponse()),
      ),
    );
    renderAt('?paperCode=AIPTA-2024-01&ids=1,2,3,4,5&total=5');

    await waitFor(() =>
      expect(
        screen.getByTestId('essay-exam-results-weighted-total'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId('essay-exam-results-weighted-total'),
    ).toHaveTextContent('55.6');
    expect(
      screen.getByTestId('essay-exam-results-progress'),
    ).toHaveTextContent('3 / 5');
  });

  it('R2 P0 — paperQuery slow but grades all completed → progress shows scored count, not 0', async () => {
    // 实战 bug: backend essay grade ~215ms 返 completed, 但 paperQuery 还在
    // loading (没 resolve) → fullScoreByQuestionId 是空 map → eligible 全
    // 排除 → weighted.completed=0. 修复前 progress 显示 "0/2 已完成评分",
    // 必须 location.reload() 才正常. 修复后用 weighted.scored 显示真实评分回来数.
    server.use(
      http.get('/api/v2/essay/grades/:id', ({ params }) =>
        HttpResponse.json(
          RECORD('completed', {
            id: Number(params.id),
            questionId: 100 + Number(params.id),
            score: 80,
          }),
        ),
      ),
      // paperQuery 永不 resolve — 模拟慢于 grades poll 的环境
      http.get('/api/v2/papers/:code/questions', async () => {
        await new Promise(() => {});
        return HttpResponse.json([]);
      }),
    );
    renderAt('?paperCode=AIPTA-2024-01&ids=1,2&total=2');

    await waitFor(() =>
      expect(screen.getByTestId('essay-exam-results-list')).toBeInTheDocument(),
    );
    // grades 全 completed 已渲染
    await waitFor(() =>
      expect(
        screen.getByTestId('essay-exam-results-completed-1'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId('essay-exam-results-completed-2'),
    ).toBeInTheDocument();
    // weighted 显示 "无法计算" (paperQuery 没就绪 → fullScore 全缺)
    expect(
      screen.getByTestId('essay-exam-results-weighted-pending'),
    ).toBeInTheDocument();
    // 关键: progress 必须显示 2/2 (scored), 不是 0/2 (completed)
    expect(
      screen.getByTestId('essay-exam-results-progress'),
    ).toHaveTextContent('2 / 2');
  });

  it('failed retry → 创新 record → ids URL 替换对应位置 (不死链)', async () => {
    server.use(
      http.get('/api/v2/essay/grades/:id', ({ params }) => {
        const id = Number(params.id);
        if (id === 1) return HttpResponse.json(RECORD('failed', { id: 1, questionId: 101 }));
        if (id === 99) return HttpResponse.json(RECORD('pending', { id: 99, questionId: 101 }));
        return HttpResponse.json(RECORD('pending', { id, questionId: 100 + id }));
      }),
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json(makePaperQuestionsResponse()),
      ),
      http.post('/api/v2/essay/grade', () =>
        HttpResponse.json(RECORD('pending', { id: 99, questionId: 101 })),
      ),
    );
    const user = userEvent.setup();
    renderAt('?paperCode=AIPTA-2024-01&ids=1,2&total=5');

    const failedCard = await screen.findByTestId('essay-exam-results-failed-1');
    const retryBtn = within(failedCard).getByTestId('essay-grading-failed-retry');
    await user.click(retryBtn);

    // 替换后的 ids: 99,2 (位置 0 是 1 → 99)
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        'ids=99%2C2',
      ),
    );
  });

});
