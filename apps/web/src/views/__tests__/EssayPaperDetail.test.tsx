import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { Routes, Route } from 'react-router-dom';
import EssayPaperDetail from '../EssayPaperDetail';

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/essay/papers/:paperCode" element={<EssayPaperDetail />} />
    </Routes>,
    { initialEntries: [path] },
  );
}

const ESSAY_Q = (id: number, position: number) => ({
  id,
  position,
  sourceUuid: `q-${id}`,
  questionKind: 'essay',
  subtypeName: '申论',
  secondSubtypeName: null,
  rawRenderType: null,
  stemText: `<p>第 ${position} 题: 谈谈你对 X 的理解</p>`,
  difficultyCode: 'unknown',
  examYear: 2024,
  sourceProvider: 'aipta',
  sourceKind: '国考',
  isGradable: false,
  rendererKey: 'essay',
  enabled: true,
  tags: [],
  materialGroupId: null,
  paperCode: 'AIPTA-2024-01',
  paperName: 'demo',
  revisionNumber: 1,
  explanationText: '',
  options: [],
  assets: [],
  specialPayload: {},
  typePayload: { fullScore: 40, wordLimitMax: 1000 },
  selectionMode: 'none',
  canonicalTopType: null,
  canonicalSubtype: null,
  canonicalSecondSubtype: null,
  // backend serialize 把 type_payload 白名单字段抽到 content.essayMetadata
  // (跟 EssayRenderer / EssayEditor SSOT 一致); typePayload 仍 raw 保留
  // 但 FE 不读 (review P2-1).
  content: {
    stem: `<p>第 ${position} 题: 谈谈你对 X 的理解</p>`,
    options: [],
    essayMetadata: { fullScore: 40, wordLimitMax: 1000 },
  },
});

const MCQ_Q = {
  ...ESSAY_Q(99, 99),
  questionKind: 'single_choice',
  rendererKey: 'single_choice',
  stemText: '<p>1+1=?</p>',
  typePayload: {},
};

describe('EssayPaperDetail', () => {
  it('列 essay 题, 跳过 non-essay', async () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json([ESSAY_Q(1, 1), ESSAY_Q(2, 2), MCQ_Q]),
      ),
    );
    renderAt('/essay/papers/AIPTA-2024-01');
    await waitFor(() =>
      expect(screen.getByTestId('essay-paper-detail-questions')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('essay-paper-detail-question-1')).toBeInTheDocument();
    expect(screen.getByTestId('essay-paper-detail-question-2')).toBeInTheDocument();
    // non-essay 不渲染
    expect(screen.queryByTestId('essay-paper-detail-question-99')).not.toBeInTheDocument();
    // 满分 / 字数限制 metadata 渲染
    expect(screen.getAllByText(/满分 40/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/≤ 1000/).length).toBeGreaterThan(0);
  });

  it('全部非 essay → empty state (本卷里没有申论题)', async () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json([MCQ_Q])),
    );
    renderAt('/essay/papers/MCQ-CASE');
    await waitFor(() =>
      expect(screen.getByText('本卷里没有申论题.')).toBeInTheDocument(),
    );
  });

  it('HTTP error → retry button', async () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json({ detail: 'x' }, { status: 500 }),
      ),
    );
    renderAt('/essay/papers/X');
    await waitFor(() =>
      expect(screen.getByTestId('essay-paper-detail-retry')).toBeInTheDocument(),
    );
  });

  it('点 essay-paper-detail-retry → 二次 fetch 成功 → questions list 渲', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/v2/papers/:code/questions', () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ detail: 'transient' }, { status: 503 });
        }
        return HttpResponse.json([ESSAY_Q(1, 1), ESSAY_Q(2, 2)]);
      }),
    );
    const user = userEvent.setup();
    renderAt('/essay/papers/X');

    const retry = await screen.findByTestId('essay-paper-detail-retry');
    await user.click(retry);
    await waitFor(() =>
      expect(screen.getByTestId('essay-paper-detail-questions')).toBeInTheDocument(),
    );
    expect(callCount).toBe(2);
  });
});
