import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import EssaySpecialty from '../EssaySpecialty';

// + 5 CategoryCard 替换. 后端 endpoint 从 /essay/specialty/questions 切到
// /papers/essay/specialty/{summary,categories}.

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const SUMMARY_WITH_RESUME = {
  totals: {
    practiced: 187,
    total: 2337,
    streakDays: 14,
    weekDone: 23,
    avgScore: 38.4,
  },
  resume: {
    typeName: '综合概括',
    questionId: 7501,
    qIndex: 75,
    qTotal: 742,
    lastScores: [34, 41, 38],
    weekGoal: [3, 7],
  },
};

const SUMMARY_EMPTY = {
  totals: {
    practiced: 0,
    total: 2337,
    streakDays: 0,
    weekDone: 0,
    avgScore: 0,
  },
  resume: null,
};

const CATEGORIES_BASIC = {
  cats: [
    {
      id: '归纳概括',
      idx: 1,
      name: '归纳概括',
      desc: '从材料中提炼问题',
      overallProgress: 0.34,
      practiced: 253,
      total: 742,
      state: null,
      subTypes: [
        {
          id: 'q-7501',
          questionId: 7501,
          name: '全部 · 归纳概括',
          meta: '所有子项混合 · 推荐',
          practiced: 253,
          total: 742,
          status: 'progress' as const,
        },
        {
          id: 'q-7502',
          questionId: 7502,
          name: '单一概括',
          meta: '问题 / 原因 / 影响',
          practiced: 96,
          total: 96,
          status: 'done' as const,
        },
      ],
    },
    {
      id: '公文',
      idx: 4,
      name: '公文 · 应用文',
      desc: '通知 · 讲话稿',
      overallProgress: 0,
      practiced: 0,
      total: 0,
      state: 'empty' as const,
      subTypes: [],
    },
  ],
};

function setupHandlers(
  summary: typeof SUMMARY_WITH_RESUME | typeof SUMMARY_EMPTY,
  categories: typeof CATEGORIES_BASIC,
) {
  server.use(
    http.get('/api/v2/papers/essay/specialty/summary', () =>
      HttpResponse.json(summary),
    ),
    http.get('/api/v2/papers/essay/specialty/categories', () =>
      HttpResponse.json(categories),
    ),
  );
}

describe('EssaySpecialty', () => {
  it('summary + categories 加载 → StatStrip / ResumeHero / CategoryCard 渲染', async () => {
    setupHandlers(SUMMARY_WITH_RESUME, CATEGORIES_BASIC);
    renderWithProviders(<EssaySpecialty />);
    await waitFor(() => {
      expect(screen.getByTestId('essay-specialty-stat-strip')).toBeInTheDocument();
    });
    // StatStrip 4 格
    expect(screen.getByTestId('essay-specialty-stat-practiced')).toHaveTextContent('187');
    expect(screen.getByTestId('essay-specialty-stat-streak')).toHaveTextContent('14');
    // ResumeHero
    expect(screen.getByTestId('essay-specialty-resume-hero')).toBeInTheDocument();
    expect(screen.getByTestId('essay-specialty-resume-recent')).toHaveTextContent('34 · 41 · 38');
    // CategoryCard 渲染 + empty cat 渲染但无 body
    expect(screen.getByTestId('essay-specialty-cat-归纳概括')).toBeInTheDocument();
    expect(screen.getByTestId('essay-specialty-cat-公文')).toHaveAttribute(
      'data-empty',
      'true',
    );
  });

  it('resume === null → ResumeHero 不渲染', async () => {
    setupHandlers(SUMMARY_EMPTY, CATEGORIES_BASIC);
    renderWithProviders(<EssaySpecialty />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-specialty-stat-strip')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('essay-specialty-resume-hero')).toBeNull();
  });

  it('点击 subtype 行 → navigate /essay/specialty/{questionId}', async () => {
    navigate.mockClear();
    setupHandlers(SUMMARY_WITH_RESUME, CATEGORIES_BASIC);
    const user = userEvent.setup();
    renderWithProviders(<EssaySpecialty />);
    // 第一卡默认 open (因 resume 在第一卡)
    const subtype = await screen.findByTestId('essay-specialty-subtype-q-7502');
    await user.click(subtype);
    expect(navigate).toHaveBeenCalledWith('/essay/specialty/7502');
  });

  it('点击 ResumeHero 继续按钮 → navigate /essay/specialty/{resumeQuestionId}', async () => {
    navigate.mockClear();
    setupHandlers(SUMMARY_WITH_RESUME, CATEGORIES_BASIC);
    const user = userEvent.setup();
    renderWithProviders(<EssaySpecialty />);
    const cta = await screen.findByTestId('essay-specialty-resume-continue');
    await user.click(cta);
    expect(navigate).toHaveBeenCalledWith('/essay/specialty/7501');
  });

  it('CategoryCard CTA → navigate 该类首 subType questionId', async () => {
    navigate.mockClear();
    setupHandlers(SUMMARY_WITH_RESUME, CATEGORIES_BASIC);
    const user = userEvent.setup();
    renderWithProviders(<EssaySpecialty />);
    const cta = await screen.findByTestId('essay-specialty-cat-归纳概括-cta');
    await user.click(cta);
    expect(navigate).toHaveBeenCalledWith('/essay/specialty/7501');
  });

  it('empty categories → empty state 文案', async () => {
    setupHandlers(SUMMARY_EMPTY, { cats: [] });
    renderWithProviders(<EssaySpecialty />);
    await waitFor(() =>
      expect(screen.getByText('暂无分类')).toBeInTheDocument(),
    );
  });
});
