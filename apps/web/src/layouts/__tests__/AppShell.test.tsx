import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { AppShell } from '../AppShell';

// AppShell tests — Block H sidebar v3 (行测试炼 + 申论试炼 嵌套分组).
//
// 测试范围:
//   1. 平铺 NavLink (首页 / 错题本 / 考试日历) 渲染
//   2. Group (行测试炼 / 申论试炼) 渲染 + chevron toggle + localStorage 持久化
//   3. Disabled 子项 (申论·专项练习) 不可点 + 显示"敬请期待" badge
//   4. Active 检测 — 子项匹配 pathname / hash, group 内任一 active 自动展开
//
// Wave 1 Round 2 (2026-05-11): 删 'dashboard' nav entry (IA #1 立意 sidebar home
// → /dashboard, 独立"学情数据"nav 重叠 redundant). /dashboard 路由保留, 走 logo
// 或 /app redirect 进入.
//
// PR16 (2026-05-13): 行测/申论 4 入口收编进 /practice/center hub. sidebar 4 个
// 子项 to 全切到 /practice/center/{xingce|essay}/{categories|papers} 新 canonical;
// 老路径 (/papers, /xingce/specialty, /essay/papers, /essay/specialty,
// /categories, /essay/categories) 由 router 层 Navigate 兜底. sidebar match
// 函数同时认新老路径, 直接进老 URL 也 active 命中.
//
// 不测的:
//   - framer-motion 动画 (jsdom 不 fire transitionend, 测了也失真)
//   - Identity / Brand 显示 (走 useAuthStore, 单独测试)

const renderShell = (initialEntries: readonly string[] = ['/app']) => {
  // AppShell 必须挂在 router context 下才能 useLocation. 用 Routes wrap 让
  // /app 这条路径走 AppShell+Outlet, Outlet 渲染空 content (sidebar 测试不关心).
  //
  // PR16: 新 canonical sub-path + 老路径双重挂载, 测试覆盖 redirect 前后两套.
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/app" element={<div data-testid="page-app" />} />
        <Route path="/papers" element={<div data-testid="page-papers" />} />
        <Route path="/categories" element={<div data-testid="page-categories" />} />
        <Route path="/xingce/specialty" element={<div data-testid="page-xingce-specialty" />} />
        <Route path="/essay/papers" element={<div data-testid="page-essay" />} />
        <Route path="/essay/specialty" element={<div data-testid="page-essay-specialty" />} />
        <Route path="/essay/categories" element={<div data-testid="page-essay-categories" />} />
        <Route
          path="/practice/center/xingce/categories"
          element={<div data-testid="page-xingce-specialty" />}
        />
        <Route
          path="/practice/center/xingce/papers"
          element={<div data-testid="page-papers" />}
        />
        <Route
          path="/practice/center/essay/categories"
          element={<div data-testid="page-essay-specialty" />}
        />
        <Route
          path="/practice/center/essay/papers"
          element={<div data-testid="page-essay" />}
        />
        <Route path="/wrong-book" element={<div data-testid="page-wrong" />} />
      </Route>
    </Routes>,
    { initialEntries },
  );
};

// 仅测桌面 sidebar (md+). jsdom 默认 width 是 1024 不触发 md:hidden, sidebar
// 会渲染. 但 hidden md:flex 在 jsdom 不会真的 hide (CSS 不生效), 所以 sidebar
// 元素一直在 DOM 内, 测试可直接 query.
describe('AppShell sidebar v3 (Block H)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom 不实现 framer-motion 期望的 ResizeObserver — 给个 stub.
    if (!window.ResizeObserver) {
      window.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }));
    }
  });

  it('renders top-level NavLinks (首页 / 错题本 / 日历)', () => {
    renderShell(['/app']);
    expect(screen.getByTestId('nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('nav-wrong-book')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-calendar')).toBeInTheDocument();
  });

  it('renders 行测练习 group with 2 children (PR16 入口指向 /practice/center/xingce/*)', () => {
    renderShell(['/app']);
    const group = screen.getByTestId('nav-group-xingce');
    expect(group).toBeInTheDocument();
    // PR16 (2026-05-13): 入口改指 /practice/center/xingce/categories. 旧
    // /xingce/specialty / /categories 由 router Navigate 兼容 + sidebar match
    // 函数同时认新老路径 (active 不漂).
    const specialty = within(group).getByTestId('nav-xingce-specialty');
    expect(specialty.tagName).toBe('A');
    expect(specialty).toHaveAttribute('href', '/practice/center/xingce/categories');
    expect(within(group).getByTestId('nav-xingce-papers')).toBeInTheDocument();
  });

  it('renders 申论练习 group with 专项练习 + 套卷练习 (PR16 入口指向 /practice/center/essay/*)', () => {
    renderShell(['/essay/papers']);
    const group = screen.getByTestId('nav-group-essay');
    // PR16 (2026-05-13): 入口改指 /practice/center/essay/{categories|papers}.
    // 旧 /essay/specialty / /essay/papers / /essay/categories 由 router 层
    // Navigate 兼容老书签 / 外链, sidebar match 函数双认.
    const specialty = within(group).getByTestId('nav-essay-specialty');
    expect(specialty.tagName).toBe('A');
    expect(specialty).toHaveAttribute('href', '/practice/center/essay/categories');
    expect(specialty).not.toHaveTextContent('敬请期待');
    // 套卷练习仍是真链接
    const papers = within(group).getByTestId('nav-essay-papers');
    expect(papers.tagName).toBe('A');
    expect(papers).toHaveAttribute('href', '/practice/center/essay/papers');
  });

  it('PR16 — 申论·专项练习 active 当路由是 /practice/center/essay/categories (to 自身相等)', () => {
    renderShell(['/practice/center/essay/categories']);
    const specialty = screen.getByTestId('nav-essay-specialty');
    // 新 canonical 路径下 to=/practice/center/essay/categories 自身相等,
    // react-router 自动 aria-current='page' + match 函数也命中 → 双重保险.
    expect(specialty).toHaveAttribute('aria-current', 'page');
    expect(specialty.className).toContain('bg-ink-1');
    // 套卷练习 不应同时 active (papers match 收紧到只 papers 前缀)
    const papers = screen.getByTestId('nav-essay-papers');
    expect(papers.className).not.toContain('bg-ink-1');
  });

  it('PR16 — 申论·专项练习 仍 active 当路由是 /essay/categories (老路径 match 兜底)', () => {
    renderShell(['/essay/categories']);
    const specialty = screen.getByTestId('nav-essay-specialty');
    // /essay/categories 路径下 to='/practice/center/essay/categories' ≠ pathname,
    // react-router 不会自动 aria-current. active 由 entry.match 函数判定 +
    // bg-ink-1 className. (生产路由侧 router/index.tsx 已 Navigate redirect
    // /essay/categories → /practice/center/essay/categories, 此 test path
    // 直接进 sidebar 测试 stub route, 验 match 函数容错).
    expect(specialty.className).toContain('bg-ink-1');
    // 套卷练习 不应被 categories 路径误命中.
    const papers = screen.getByTestId('nav-essay-papers');
    expect(papers).not.toHaveAttribute('aria-current', 'page');
    expect(papers.className).not.toContain('bg-ink-1');
  });

  it('group toggle button 切折叠状态 + chevron aria-expanded 翻转', async () => {
    const user = userEvent.setup();
    renderShell(['/app']);
    const toggle = screen.getByTestId('nav-group-xingce-toggle');
    // 默认展开
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('折叠状态写入 localStorage', async () => {
    const user = userEvent.setup();
    renderShell(['/app']);
    await user.click(screen.getByTestId('nav-group-essay-toggle'));
    const stored = window.localStorage.getItem('sikao.sidebar.collapsedGroups');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual(['essay']);
  });

  it('mount 时 localStorage 已存折叠态 → group 渲染折叠 (essay 子项不可见)', () => {
    window.localStorage.setItem(
      'sikao.sidebar.collapsedGroups',
      JSON.stringify(['essay']),
    );
    renderShell(['/app']);
    // 折叠 group 仍渲染 toggle button (toggle button aria-expanded=false)
    const toggle = screen.getByTestId('nav-group-essay-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('group 内子项 active 时强制展开 (即使 localStorage 折叠)', () => {
    // localStorage 标 essay 折叠, 但路由进 /essay/papers → essay 子项 active
    // → 强制展开 (effectivelyCollapsed = false), aria-expanded=true
    window.localStorage.setItem(
      'sikao.sidebar.collapsedGroups',
      JSON.stringify(['essay']),
    );
    renderShell(['/essay/papers']);
    const toggle = screen.getByTestId('nav-group-essay-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('PR16 — 行测·专项练习 active 当路由是 /practice/center/xingce/categories (to 自身相等)', () => {
    renderShell(['/practice/center/xingce/categories']);
    const specialty = screen.getByTestId('nav-xingce-specialty');
    // 新 canonical 下 to 自身相等, react-router 自动 aria-current='page' +
    // match 函数也命中 → active 双重保险.
    expect(specialty).toHaveAttribute('aria-current', 'page');
    expect(specialty.className).toContain('bg-ink-1');
  });

  it('PR16 — 行测·专项练习 仍 active 当路由是 /xingce/specialty (老路径 match 兜底)', () => {
    renderShell(['/xingce/specialty']);
    const specialty = screen.getByTestId('nav-xingce-specialty');
    // /xingce/specialty 路径下 to='/practice/center/xingce/categories' ≠ pathname,
    // react-router 不会自动 aria-current. active 由 entry.match 函数判定 (覆盖
    // /xingce/specialty 老路径) + bg-ink-1 className.
    expect(specialty.className).toContain('bg-ink-1');
  });

  it('PR16 — 行测·专项练习 仍 active 当路由是 /categories (二段 redirect 前 match 兜底)', () => {
    renderShell(['/categories']);
    const specialty = screen.getByTestId('nav-xingce-specialty');
    expect(specialty.className).toContain('bg-ink-1');
  });

  it('PR16 — 行测·套卷练习 click 跳 /practice/center/xingce/papers + active 命中', async () => {
    // PR16 把"套卷练习"从 /papers 切到 /practice/center/xingce/papers 新 canonical.
    // 1. 点 nav 触发 navigate 到新 canonical (Route 渲 page-papers test marker).
    // 2. 落地后 nav-xingce-papers active (aria-current=page),
    //    nav-home 不应被误命中.
    const user = userEvent.setup();
    renderShell(['/app']);
    const xingcePapers = screen.getByTestId('nav-xingce-papers');
    expect(xingcePapers).toHaveAttribute('href', '/practice/center/xingce/papers');
    await user.click(xingcePapers);
    expect(await screen.findByTestId('page-papers')).toBeInTheDocument();
    expect(screen.getByTestId('nav-xingce-papers')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('nav-home')).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('localStorage 存的非 group slug 数据被过滤 (fail-safe)', () => {
    // 用户 / 旧版本写入 invalid slug → readCollapsed 过滤回干净 list
    window.localStorage.setItem(
      'sikao.sidebar.collapsedGroups',
      JSON.stringify(['xingce', 'invalid-slug-xyz']),
    );
    renderShell(['/app']);
    // xingce 仍折叠生效, invalid-slug-xyz 静默丢弃
    expect(screen.getByTestId('nav-group-xingce-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('localStorage 存的 JSON 解析失败 → 视为全展开 (不 crash)', () => {
    window.localStorage.setItem(
      'sikao.sidebar.collapsedGroups',
      'this-is-not-json{{{',
    );
    renderShell(['/app']);
    // 默认全展开
    expect(screen.getByTestId('nav-group-xingce-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('nav-group-essay-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
