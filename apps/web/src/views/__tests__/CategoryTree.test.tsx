/**
 *
 * 接 Xa-BE 7a06b94 2 endpoint (mirror EssaySpecialty):
 *   - /papers/xingce/specialty/summary    → StatStrip + ResumeHero
 *   - /papers/xingce/specialty/categories → 5 CategoryCard
 *
 * 旧 6 卡 ProgressBar grid 测试 (/categories endpoint) 整套替换.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import CategoryTree from '../CategoryTree';

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
    practiced: 1200,
    total: 91710,
    streakDays: 7,
    weekDone: 84,
    avgScore: 68.5,
  },
  resume: {
    typeName: '言语理解',
    questionId: 50001,
    qIndex: 230,
    qTotal: 18000,
    lastScores: [100, 0, 100],
    weekGoal: [3, 7],
  },
};

const SUMMARY_EMPTY = {
  totals: {
    practiced: 0,
    total: 91710,
    streakDays: 0,
    weekDone: 0,
    avgScore: 0,
  },
  resume: null,
};

const CATEGORIES_BASIC = {
  cats: [
    {
      id: 'yanyu',
      idx: 1,
      name: '言语理解',
      desc: '语句表达 / 阅读理解 / 逻辑填空',
      overallProgress: 0.21,
      practiced: 3780,
      total: 18000,
      state: null,
      subTypes: [
        {
          id: 'q-50001',
          questionId: 50001,
          name: '逻辑填空 · 实词',
          meta: '2024 国考 · 第 21 题',
          practiced: 1,
          total: 1,
          status: 'progress' as const,
        },
        {
          id: 'q-50002',
          questionId: 50002,
          name: '片段阅读 · 主旨概括',
          meta: '2024 国考 · 第 35 题',
          practiced: 1,
          total: 1,
          status: 'done' as const,
        },
      ],
    },
    {
      id: 'changshi',
      idx: 5,
      name: '常识判断',
      desc: '时政 / 法律 / 经济 / 科技',
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
    http.get('/api/v2/papers/xingce/specialty/summary', () =>
      HttpResponse.json(summary),
    ),
    http.get('/api/v2/papers/xingce/specialty/categories', () =>
      HttpResponse.json(categories),
    ),
  );
}

describe('CategoryTree (xingce specialty)', () => {
  it('summary + categories 加载 → StatStrip / ResumeHero / CategoryCard 渲染', async () => {
    setupHandlers(SUMMARY_WITH_RESUME, CATEGORIES_BASIC);
    renderWithProviders(<CategoryTree />);
    await waitFor(() => {
      expect(screen.getByTestId('xingce-specialty-stat-strip')).toBeInTheDocument();
    });
    // StatStrip 4 格 (avgScore=68.5 → 显示 + % suffix)
    expect(screen.getByTestId('xingce-specialty-stat-practiced')).toHaveTextContent('1200');
    expect(screen.getByTestId('xingce-specialty-stat-streak')).toHaveTextContent('7');
    expect(screen.getByTestId('xingce-specialty-stat-avg')).toHaveTextContent('68.5');
    expect(screen.getByTestId('xingce-specialty-stat-avg')).toHaveTextContent('%');
    // ResumeHero
    expect(screen.getByTestId('xingce-specialty-resume-hero')).toBeInTheDocument();
    expect(screen.getByTestId('xingce-specialty-resume-recent')).toHaveTextContent('100 · 0 · 100');
    // CategoryCard 渲染 + empty cat 渲染但无 body
    expect(screen.getByTestId('xingce-specialty-cat-yanyu')).toBeInTheDocument();
    expect(screen.getByTestId('xingce-specialty-cat-changshi')).toHaveAttribute(
      'data-empty',
      'true',
    );
  });

  it('resume === null → ResumeHero 不渲染', async () => {
    setupHandlers(SUMMARY_EMPTY, CATEGORIES_BASIC);
    renderWithProviders(<CategoryTree />);
    await waitFor(() =>
      expect(screen.getByTestId('xingce-specialty-stat-strip')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('xingce-specialty-resume-hero')).toBeNull();
  });

  it('CategoryCard CTA → navigate /practice/custom/start?topType={cat.name}', async () => {
    navigate.mockClear();
    setupHandlers(SUMMARY_WITH_RESUME, CATEGORIES_BASIC);
    const user = userEvent.setup();
    renderWithProviders(<CategoryTree />);
    const cta = await screen.findByTestId('xingce-specialty-cat-yanyu-cta');
    await user.click(cta);
    expect(navigate).toHaveBeenCalledWith(
      `/practice/custom/start?topType=${encodeURIComponent('言语理解')}`,
    );
  });

  it('empty categories → empty state 文案', async () => {
    setupHandlers(SUMMARY_EMPTY, { cats: [] });
    renderWithProviders(<CategoryTree />);
    await waitFor(() =>
      expect(screen.getByText('题库准备中')).toBeInTheDocument(),
    );
  });

  it('avgScore=0 → StatStrip avg 显示 "—"', async () => {
    setupHandlers(SUMMARY_EMPTY, CATEGORIES_BASIC);
    renderWithProviders(<CategoryTree />);
    await waitFor(() =>
      expect(screen.getByTestId('xingce-specialty-stat-avg')).toHaveTextContent('—'),
    );
  });
});
