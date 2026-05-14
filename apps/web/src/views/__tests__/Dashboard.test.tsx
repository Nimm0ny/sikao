import { describe, it, expect, vi } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import Dashboard from '../Dashboard';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

/**
 * SIKAO Wave 8 Phase D (2026-05-12) Dashboard 4-block layout 落地测试.
 *
 * 旧 SIKAO Wave 1 02-hifi assertions (FocusCard / StreakCard / WeekRhythmCard /
 * PlanTasksCard / AiHintCard / MetricsRow / WeakPointsCard / 6 query partial-fail
 * / DashboardSkeleton 切换 / today-plan-empty CTA) 全部退役 — 当前 view 走 4
 * block (continue / today-plan / upcoming-exams / weak-modules) + ExamCustomSheet
 * 自定义考试, 数据走真 useQuery hook (useHomeData.ts) wrapping BE endpoints,
 * msw handlers 在 test-utils/handlers.ts 提供 fixture.
 *
 * 测试覆盖范围:
 *   - hero greeting renders
 *   - 4 block 都 mount + 严格顺序 (block 1 → 4)
 *   - block 1 happy (lastSession 非 null) → paper title + continue CTA
 *   - block 2 happy (plan tasks list) → daily_quota 显
 *   - block 3 happy (>=2 exam) → chip 切换
 *   - block 4 happy (top weak module) → subject + label color hint
 *   - ExamCustomSheet 点 "编辑考试" 开 + "新增" 展表单 + 取消收回
 *
 * mock 默认 happy 态 (msw handlers 返回固定 fixture). 后续 slice 在 single case
 * 用 server.use() override empty / error / loading 三态.
 */

describe('Dashboard (Wave 8 Phase D — 4 block layout, real useQuery)', () => {
  it('renders dashboard-view + hero greeting', () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-hero')).toBeInTheDocument();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/好[,，]/);
    // eyebrow 含 WEEK + 大写 weekday
    expect(screen.getByText(/WEEK \d+/)).toBeInTheDocument();
  });

  it('renders 4 block container with all 4 blocks in order', () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    const container = screen.getByTestId('dashboard-home-blocks');
    expect(container).toBeInTheDocument();

    // 4 block 都 mount (block 容器立即在 DOM 中, 不依赖数据)
    expect(within(container).getByTestId('home-continue-block')).toBeInTheDocument();
    expect(within(container).getByTestId('home-today-plan-block')).toBeInTheDocument();
    expect(within(container).getByTestId('home-upcoming-exams-block')).toBeInTheDocument();
    expect(within(container).getByTestId('home-weak-modules-block')).toBeInTheDocument();

    // 严格顺序: 通过 DOM 顺序断言
    const directChildren = Array.from(container.children).map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(directChildren).toEqual([
      'home-continue-block',
      'home-today-plan-block',
      'home-upcoming-exams-block',
      'home-weak-modules-block',
    ]);
  });

  it('block 1 (继续学习) renders paper title + 继续 CTA when lastSession non-null', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    const block = screen.getByTestId('home-continue-block');
    expect(
      within(block).getByRole('heading', { name: '继续学习' }),
    ).toBeInTheDocument();
    // 等 useQuery resolve: paper_title = "2024 国考行测"
    const title = await within(block).findByTestId('home-continue-paper-title');
    expect(title).toHaveTextContent('2024 国考行测');
    // 继续 CTA
    expect(
      within(block).getByTestId('home-continue-resume'),
    ).toHaveTextContent('继续');
  });

  it('block 2 (今日计划) renders task list + daily_quota strip', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    const block = screen.getByTestId('home-today-plan-block');
    expect(
      within(block).getByRole('heading', { name: '今日计划' }),
    ).toBeInTheDocument();
    // mock data: doneCount=1, totalCount=3 (等 useQuery resolve)
    const progress = await within(block).findByTestId('home-today-plan-progress');
    expect(progress).toHaveTextContent('1 / 3');
    // Wave 8 Phase A daily_quota / accuracy_target 字段
    expect(
      within(block).getByTestId('home-today-plan-quota'),
    ).toHaveTextContent(/每日 50 题/);
    expect(
      within(block).getByTestId('home-today-plan-quota'),
    ).toHaveTextContent(/正确率目标 80%/);
    // 任务列表
    const list = within(block).getByTestId('home-today-plan-tasks');
    expect(within(list).getByText(/言语 · 片段阅读/)).toBeInTheDocument();
    expect(within(list).getByText(/数量 · 数学运算/)).toBeInTheDocument();
  });

  it('block 3 (临考冲刺) renders active exam + chip 切换', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    const block = screen.getByTestId('home-upcoming-exams-block');
    expect(
      within(block).getByRole('heading', { name: '临考冲刺' }),
    ).toBeInTheDocument();

    // 等 useQuery resolve: active = 第一场 (省考)
    const activeName = await within(block).findByTestId('home-upcoming-active-name');
    expect(activeName).toHaveTextContent('省考');

    // 2 场 exam → chip strip 显
    const chips = within(block).getByTestId('home-upcoming-exam-chips');
    expect(chips).toBeInTheDocument();

    // 切换到国考 (chip id = 2)
    const guokaoChip = within(block).getByTestId('home-upcoming-exam-chip-2');
    fireEvent.click(guokaoChip);
    expect(
      within(block).getByTestId('home-upcoming-active-name'),
    ).toHaveTextContent('国考');
  });

  it('block 4 (薄弱模块) renders top weak subject + label hint', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    const block = screen.getByTestId('home-weak-modules-block');
    expect(
      within(block).getByRole('heading', { name: '薄弱模块' }),
    ).toBeInTheDocument();
    // 等 useQuery resolve: top 数量 score 78 → 急需
    const topSubject = await within(block).findByTestId('home-weak-top-subject');
    expect(topSubject).toHaveTextContent('数量');
    expect(
      within(block).getByTestId('home-weak-top-label'),
    ).toHaveTextContent('急需');
    // 次薄弱 row
    expect(
      within(block).getByTestId('home-weak-second-row'),
    ).toHaveTextContent('判推');
    // 去练习 CTA
    expect(within(block).getByTestId('home-weak-practice')).toHaveTextContent(
      '去练习',
    );
  });

  it('ExamCustomSheet opens when block 3 "编辑考试" clicked, form toggles', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    // 等 useQuery resolve (block 3 happy 态 chip + 编辑按钮才会渲)
    const editBtn = await screen.findByTestId('home-upcoming-exams-edit');
    fireEvent.click(editBtn);

    // sheet header 显
    expect(screen.getByTestId('exam-custom-sheet-header')).toBeInTheDocument();
    // 现有 exam list 列出 2 场
    const list = screen.getByTestId('exam-custom-sheet-list');
    expect(within(list).getByTestId('exam-custom-row-1')).toBeInTheDocument();
    expect(within(list).getByTestId('exam-custom-row-2')).toBeInTheDocument();

    // 默认表单收起 — 点 "新增" 展开
    expect(screen.queryByTestId('exam-custom-sheet-form')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('exam-custom-add-new'));
    expect(screen.getByTestId('exam-custom-sheet-form')).toBeInTheDocument();
    expect(screen.getByTestId('exam-custom-form-name')).toBeInTheDocument();
    expect(screen.getByTestId('exam-custom-form-date')).toBeInTheDocument();

    // 取消收回
    fireEvent.click(screen.getByTestId('exam-custom-form-cancel'));
    expect(screen.queryByTestId('exam-custom-sheet-form')).not.toBeInTheDocument();
  });
});
