import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import CustomPracticeStart from '../CustomPracticeStart';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('CustomPracticeStart', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('loads facets and starts a targeted practice session', async () => {
    const startPayloads: unknown[] = [];

    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 985,
          years: [2026, 2025, 2024, 2023],
          topTypes: [
            {
              name: '政治理论',
              questionCount: 985,
              years: [2026, 2025, 2024],
              subtypes: [
                {
                  name: '时政',
                  questionCount: 320,
                  years: [2026, 2025, 2024],
                  secondSubtypes: [
                    { name: '国内时政', questionCount: 120, years: [2026, 2025] },
                  ],
                },
              ],
            },
            {
              name: '资料分析',
              questionCount: 12108,
              years: [2026, 2025, 2024, 2023],
              subtypes: [],
            },
          ],
        }),
      ),
      http.post('/api/v2/practice/custom/start', async ({ request }) => {
        startPayloads.push(await request.json());
        return HttpResponse.json({
          sessionId: 903,
          paperCode: '__custom_practice__',
          paperRevisionId: null,
          paperName: '专项练习',
          sections: [],
          savedAnswers: {},
        });
      }),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    fireEvent.click(screen.getByRole('button', { name: '政治理论' }));
    fireEvent.click(screen.getByRole('button', { name: '近三年' }));
    fireEvent.click(screen.getByRole('button', { name: '开始专项练习' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/practice/sessions/903');
    });
    expect(startPayloads).toEqual([
      {
        topType: '政治理论',
        years: [2026, 2025, 2024],
        questionCount: 10,
      },
    ]);
  });

  it('uses the selected second subtype years for recent-year payloads', async () => {
    const startPayloads: unknown[] = [];

    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 120,
          years: [2026, 2025, 2024, 2023],
          topTypes: [
            {
              name: '政治理论',
              questionCount: 120,
              years: [2026, 2025, 2024, 2023],
              subtypes: [
                {
                  name: '时政',
                  questionCount: 80,
                  years: [2025, 2024, 2023],
                  secondSubtypes: [
                    { name: '国内时政', questionCount: 30, years: [2024, 2022, 2021] },
                  ],
                },
              ],
            },
          ],
        }),
      ),
      http.post('/api/v2/practice/custom/start', async ({ request }) => {
        startPayloads.push(await request.json());
        return HttpResponse.json({
          sessionId: 904,
          paperCode: '__custom_practice__',
          paperRevisionId: null,
          paperName: '专项练习',
          sections: [],
          savedAnswers: {},
        });
      }),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    fireEvent.click(screen.getByRole('button', { name: '时政' }));
    fireEvent.click(screen.getByRole('button', { name: '国内时政' }));
    fireEvent.click(screen.getByRole('button', { name: '近三年' }));
    fireEvent.click(screen.getByRole('button', { name: '开始专项练习' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/practice/sessions/904');
    });
    expect(startPayloads).toEqual([
      {
        topType: '政治理论',
        subtype: '时政',
        secondSubtype: '国内时政',
        years: [2024, 2022, 2021],
        questionCount: 10,
      },
    ]);
  });

  it('blocks invalid question count (custom > 50) before posting', async () => {
    let postCount = 0;
    server.use(
      http.post('/api/v2/practice/custom/start', () => {
        postCount += 1;
        return HttpResponse.json({ detail: 'should not post' }, { status: 500 });
      }),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    fireEvent.click(screen.getByRole('button', { name: '自定义' }));
    fireEvent.change(screen.getByLabelText('自定义题量'), { target: { value: '51' } });

    expect(screen.getByRole('button', { name: '开始专项练习' })).toBeDisabled();
    expect(screen.getByText('1 到 50 题')).toBeInTheDocument();
    expect(postCount).toBe(0);
  });


  it('题量请求 > 候选数 → banner + 禁开始 + 放宽 CTA 移 secondSubtype', async () => {
    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 1000,
          years: [2024, 2023],
          topTypes: [
            {
              name: '言语理解',
              questionCount: 1000,
              years: [2024, 2023],
              subtypes: [
                {
                  name: '逻辑填空',
                  questionCount: 30,
                  years: [2024, 2023],
                  secondSubtypes: [
                    { name: '一空', questionCount: 5, years: [2024] },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    fireEvent.click(screen.getByRole('button', { name: '逻辑填空' }));
    fireEvent.click(screen.getByRole('button', { name: '一空' }));

    // 候选 5 题 < 请求 10 题 → banner + 禁开始
    const banner = await screen.findByTestId('custom-practice-sufficiency-banner');
    expect(banner.textContent).toMatch(/仅 5 题/);
    expect(screen.getByRole('button', { name: '开始专项练习' })).toBeDisabled();

    // 点放宽 → 移 secondSubtype (subtype 仍在), 候选回到 30 (≥ 请求 10) →
    // 开始按钮启用. banner 仍显 (30 < 50 阈值, soft 模式), 但 tone 切到 "数据积累中".
    fireEvent.click(screen.getByTestId('custom-practice-relax'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始专项练习' })).not.toBeDisabled();
    });
    const after = screen.getByTestId('custom-practice-sufficiency-banner');
    expect(after.textContent).toMatch(/数据积累中/);
  });

  it('候选 < 50 + 请求满足 → soft banner (数据积累中) 但不禁开始', async () => {
    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 100,
          years: [2024],
          topTypes: [
            {
              name: '言语理解',
              questionCount: 30,
              years: [2024],
              subtypes: [],
            },
          ],
        }),
      ),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    // 30 题 ≥ 默认 10 题但 < 50 阈值 → soft banner, 开始按钮可用
    const banner = await screen.findByTestId('custom-practice-sufficiency-banner');
    expect(banner.textContent).toMatch(/数据积累中/);
    expect(screen.getByRole('button', { name: '开始专项练习' })).not.toBeDisabled();
  });

  it('连续放宽 2 次 → secondSubtype → subtype 顺序生效, 第二次后 subtype 也清', async () => {
    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 1000,
          years: [2024, 2023],
          topTypes: [
            {
              name: '言语理解',
              questionCount: 1000,
              years: [2024, 2023],
              subtypes: [
                {
                  name: '逻辑填空',
                  questionCount: 8,  // < 10 默认 → 放宽 1 次仍 insufficient
                  years: [2024, 2023],
                  secondSubtypes: [
                    { name: '一空', questionCount: 3, years: [2024] },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    fireEvent.click(screen.getByRole('button', { name: '逻辑填空' }));
    fireEvent.click(screen.getByRole('button', { name: '一空' }));

    // 候选 3 < 请求 10 → insufficient banner
    let banner = await screen.findByTestId('custom-practice-sufficiency-banner');
    expect(banner.textContent).toMatch(/仅 3 题/);

    // 第一次放宽 → 移 secondSubtype, 候选回 8 (subtype 仍在), 仍 < 10 →
    // 仍 insufficient banner, 但数字变了
    fireEvent.click(screen.getByTestId('custom-practice-relax'));
    await waitFor(() => {
      banner = screen.getByTestId('custom-practice-sufficiency-banner');
      expect(banner.textContent).toMatch(/仅 8 题/);
    });

    // 第二次放宽 → 移 subtype, 候选回 1000 (大类全选) → banner 消失
    fireEvent.click(screen.getByTestId('custom-practice-relax'));
    await waitFor(() => {
      expect(screen.queryByTestId('custom-practice-sufficiency-banner')).toBeNull();
    });
    expect(screen.getByRole('button', { name: '开始专项练习' })).not.toBeDisabled();
  });

  it('lowSample (30 题) → 灰 banner 但点开始真走 start API', async () => {
    let postCount = 0;
    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 30,
          years: [2024],
          topTypes: [
            {
              name: '言语理解',
              questionCount: 30,
              years: [2024],
              subtypes: [],
            },
          ],
        }),
      ),
      http.post('/api/v2/practice/custom/start', () => {
        postCount += 1;
        return HttpResponse.json({
          sessionId: 999,
          paperCode: '__custom_practice__',
          paperRevisionId: null,
          paperName: '专项练习',
          sections: [],
          savedAnswers: {},
        });
      }),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    const banner = await screen.findByTestId('custom-practice-sufficiency-banner');
    expect(banner.textContent).toMatch(/数据积累中/);

    fireEvent.click(screen.getByRole('button', { name: '开始专项练习' }));
    await waitFor(() => {
      expect(postCount).toBe(1);
    });
  });

  it('topType 切换 → banner 按新 topType 候选数刷新', async () => {
    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 1005,
          years: [2024],
          topTypes: [
            {
              name: '冷门大类',
              questionCount: 5,  // < 50 → lowSample
              years: [2024],
              subtypes: [],
            },
            {
              name: '热门大类',
              questionCount: 1000,  // 充足
              years: [2024],
              subtypes: [],
            },
          ],
        }),
      ),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    // 默认选第一个大类 (冷门, 5 题) → insufficient banner (<10 默认请求)
    const initialBanner = await screen.findByTestId('custom-practice-sufficiency-banner');
    expect(initialBanner.textContent).toMatch(/仅 5 题/);

    // 切到热门大类 (1000 题) → banner 应消失
    fireEvent.click(screen.getByRole('button', { name: '热门大类' }));
    await waitFor(() => {
      expect(screen.queryByTestId('custom-practice-sufficiency-banner')).toBeNull();
    });
    expect(screen.getByRole('button', { name: '开始专项练习' })).not.toBeDisabled();
  });

  it('chip 切回 custom 时 customQuestionCount 越界 → clamp 回 DEFAULT', async () => {
    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    // 切自定义 → 输 60 越界 → 切回 chip 20 → 切回自定义 → 应 reset 10
    fireEvent.click(screen.getByRole('button', { name: '自定义' }));
    fireEvent.change(screen.getByLabelText('自定义题量'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    fireEvent.click(screen.getByRole('button', { name: '自定义' }));

    const input = screen.getByLabelText('自定义题量') as HTMLInputElement;
    expect(input.value).toBe('10');
    expect(screen.queryByText('1 到 50 题')).toBeNull();
    expect(screen.getByRole('button', { name: '开始专项练习' })).not.toBeDisabled();
  });

  it('放宽到无可放宽 (已是大类全选) → 显 "本大类已全选" 不显放宽 CTA', async () => {
    server.use(
      http.get('/api/v2/practice/custom/facets', () =>
        HttpResponse.json({
          totalQuestions: 5,
          years: [2024],
          topTypes: [
            {
              name: '言语理解',
              questionCount: 5,
              years: [2024],
              subtypes: [],
            },
          ],
        }),
      ),
    );

    renderWithProviders(<CustomPracticeStart />, {
      initialEntries: ['/practice/custom/start'],
    });

    await screen.findByRole('heading', { name: '专项练习' });
    const banner = await screen.findByTestId('custom-practice-sufficiency-banner');
    expect(banner.textContent).toMatch(/本大类已全选/);
    expect(screen.queryByTestId('custom-practice-relax')).toBeNull();
  });
});
