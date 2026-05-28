import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { server } from '../../mocks/server';
import { RootLayout } from './RootLayout';
import { useCommandPaletteStore } from '@/lib/commandPalette';

/*
 * RootLayout tests — V5 §D.4 SaaS shell.
 *
 * SIK-121 W5 (2026-05-28): shared shell stays 4-tab [首页 / 练习 / 复盘 / 笔记],
 * while RailMe becomes the unique button-triggered account popover. See
 * docs/plan/sik-rail-v5-visual-contract.md §1–§2 + §7 Acceptance Hooks
 * H01/H02/H14/H15.
 */

beforeEach(() => {
  window.localStorage.clear();
  useCommandPaletteStore.setState({ open: false });
});

afterEach(() => {
  document.documentElement.removeAttribute('data-rail');
  setMatchMedia(() => false);
});

function setMatchMedia(matchesQuery: (q: string) => boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matchesQuery(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function makeRouter(
  path: string,
  user?: {
    readonly displayName: string;
    readonly subtitle?: string;
  },
) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout user={user} />,
        children: [
          { index: true, element: <div data-testid="route-home">HOME</div> },
          { path: 'practice', element: <div data-testid="route-practice">PRACTICE</div> },
          { path: 'review', element: <div data-testid="route-review">REVIEW</div> },
          { path: 'note', element: <div data-testid="route-note">NOTE</div> },
          { path: 'me', element: <div data-testid="route-me">ME</div> },
          { path: 'profile/learning', element: <div data-testid="route-profile-learning">LEARNING</div> },
          { path: 'profile/records', element: <div data-testid="route-profile-records">RECORDS</div> },
          {
            path: 'profile/practice-preferences',
            element: <div data-testid="route-profile-preferences">PREFERENCES</div>,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
}

function getRailNavLinks() {
  return within(screen.getByTestId('rail'))
    .getAllByRole('link')
    .slice(0, 4);
}

function renderRootLayout(
  path: string,
  user?: {
    readonly displayName: string;
    readonly subtitle?: string;
  },
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={makeRouter(path, user)} />
    </QueryClientProvider>,
  );
}

describe('RootLayout (V5 §D.4 SaaS shell)', () => {
  it('wraps every page in AppShell with Rail (desktop) + Workspace + Outlet', () => {
    renderRootLayout('/');
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.getByTestId('route-home').textContent).toBe('HOME');
  });

  it('renders Rail with the locked 4-tab nav order [首页, 练习, 复盘, 笔记] (no 我的)', () => {
    renderRootLayout('/');
    const labels = getRailNavLinks().map(
      (el) => el.getAttribute('aria-label') ?? el.textContent,
    );
    expect(labels).toEqual(['首页', '练习', '复盘', '笔记']);
  });

  it('does NOT render 我的 in the rail nav row (Me lives in the RailMe trigger)', () => {
    renderRootLayout('/');
    const labels = getRailNavLinks().map(
      (el) => el.getAttribute('aria-label') ?? el.textContent,
    );
    expect(labels).not.toContain('我的');
  });

  it('exposes Me entry exclusively through one button trigger', () => {
    renderRootLayout('/');
    const meTriggers = screen.getAllByRole('button', { name: '我的' });
    expect(meTriggers).toHaveLength(1);
    expect(meTriggers[0]).toHaveAttribute('data-testid', 'rail-me-trigger');
    expect(meTriggers[0]).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('marks the active nav item via data-active when its path matches', () => {
    renderRootLayout('/practice');
    const practiceLink = getRailNavLinks().find((el) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').includes('练习'),
    );
    expect(practiceLink?.dataset.active).toBe('true');
  });

  it('RailMe trigger renders Avatar + meName + meSub when user prop given', () => {
    renderRootLayout('/', {
      displayName: 'lhr',
      subtitle: 'Lv.4 学习达人',
    });
    expect(screen.getByText('lhr')).toBeInTheDocument();
    expect(screen.getByText('Lv.4 学习达人')).toBeInTheDocument();
  });

  it('RailMe falls back to placeholder name + subtitle when user prop omitted', () => {
    renderRootLayout('/');
    expect(screen.getByText('Lv.4 学习达人')).toBeInTheDocument();
    const meTrigger = screen.getByTestId('rail-me-trigger');
    expect(meTrigger.textContent).toContain('我');
    expect(meTrigger.textContent).toContain('Lv.4 学习达人');
  });

  it('RailMe trigger carries data-tip="我的" so collapsed-state CSS ::after Tooltip activates', () => {
    renderRootLayout('/');
    const meTrigger = screen.getByTestId('rail-me-trigger');
    expect(meTrigger).toHaveAttribute('data-tip', '我的');
  });

  it('opens an account popover with the locked 8-item map and disabled entries rendered as non-links', async () => {
    renderRootLayout('/');
    fireEvent.click(screen.getByTestId('rail-me-trigger'));

    const menu = screen.getByTestId('rail-me-menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '账户菜单' })).toBeInTheDocument();
    expect(screen.getByTestId('rail-me-menu-head')).toBeInTheDocument();
    expect(screen.getByTestId('rail-me-menu-summary').querySelectorAll('div')).toHaveLength(3);
    expect(screen.getByTestId('rail-me-menu-summary').textContent).toContain('累计题');
    expect(screen.getByTestId('rail-me-menu-summary').textContent).toContain('正确率');
    expect(screen.getByTestId('rail-me-menu-summary').textContent).toContain('连续天');

    const labels = [
      '概览',
      '个人信息',
      '考试目标',
      '学情',
      '学习记录',
      '偏好',
      '安全',
      '设置',
    ];
    const rendered = within(menu)
      .getAllByTestId(/rail-me-menu-item-/)
      .map((el) => el.textContent ?? '');
    labels.forEach((label) => {
      expect(rendered.some((text) => text.includes(label))).toBe(true);
    });

    expect(screen.getByTestId('rail-me-menu-item-overview')).toHaveAttribute('href', '/me');
    expect(screen.getByTestId('rail-me-menu-item-learning')).toHaveAttribute('href', '/profile/learning');
    expect(screen.getByTestId('rail-me-menu-item-info')).not.toHaveAttribute('href');
    expect(screen.getByTestId('rail-me-menu-item-info')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('rail-me-menu-item-settings')).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => {
      expect(screen.getByTestId('rail-me-menu-summary')).toHaveTextContent('1,248');
      expect(screen.getByTestId('rail-me-menu-summary')).toHaveTextContent('62%');
      expect(screen.getByTestId('rail-me-menu-summary')).toHaveTextContent('5');
    });
  });

  it('clicking an enabled account item navigates and closes the popover', async () => {
    renderRootLayout('/');
    fireEvent.click(screen.getByTestId('rail-me-trigger'));
    fireEvent.click(screen.getByTestId('rail-me-menu-item-records'));

    await waitFor(() => {
      expect(screen.getByTestId('route-profile-records')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('rail-me-menu')).toBeNull();
    });
  });

  it('marks the RailMe trigger active for the full profile-family route set', () => {
    const routes = [
      '/me',
      '/profile/learning',
      '/profile/records',
      '/profile/practice-preferences',
    ];

    routes.forEach((path) => {
      const { unmount } = renderRootLayout(path);
      expect(screen.getByTestId('rail-me-trigger')).toHaveAttribute('data-active', 'true');
      unmount();
    });
  });

  it('keeps the RailMe trigger inactive outside the profile-family routes', () => {
    renderRootLayout('/');
    expect(screen.getByTestId('rail-me-trigger')).not.toHaveAttribute('data-active');
  });

  it('closes the RailMe popover on route changes outside the account menu click path', async () => {
    renderRootLayout('/');
    fireEvent.click(screen.getByTestId('rail-me-trigger'));
    expect(screen.getByTestId('rail-me-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '练习' }));

    await waitFor(() => {
      expect(screen.getByTestId('route-practice')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('rail-me-menu')).toBeNull();
    });
  });

  it('shows em dash summary cells when progress data is unavailable', () => {
    server.use(
      http.get('/api/v2/dashboard/progress', () =>
        HttpResponse.json({
          nearestExamTarget: null,
          subjectAccuracies: [],
          summary: {
            allTime: { accuracy: null, itemsAnswered: 0, minutesPracticed: 0, sessionsCount: 0 },
            today: { accuracy: null, itemsAnswered: 0, minutesPracticed: 0, sessionsCount: 0 },
            week: { accuracy: null, itemsAnswered: 0, minutesPracticed: 0, sessionsCount: 0 },
            planSlice: null,
          },
          weaknessTop3: [],
        }),
      ),
      http.get('/api/v2/progress/weekly', () => HttpResponse.json({})),
    );

    renderRootLayout('/');
    fireEvent.click(screen.getByTestId('rail-me-trigger'));
    expect(screen.getByTestId('rail-me-menu-summary')).toHaveTextContent('—');
  });

  it('keeps mobile bottom-nav locked to the same 4-tab baseline without 我的', () => {
    setMatchMedia((q) => q.includes('max-width: 767.98px'));
    renderRootLayout('/');

    const bottomNav = screen.getByTestId('app-shell-bottom-nav');
    const labels = within(bottomNav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label') ?? link.textContent);
    expect(labels).toEqual(['首页', '练习', '复盘', '笔记']);
    expect(labels).not.toContain('我的');
  });

  // SIK-121 W2 — visual contract Acceptance Hook H05 (cmd-k slot wiring).
  // See docs/plan/sik-rail-v5-visual-contract.md §7.

  it('renders the cmd-k button inside the rail (H05 — clicking opens CommandPalette)', () => {
    renderRootLayout('/');
    const cmdBtn = screen.getByRole('button', { name: '命令搜索' });
    expect(cmdBtn).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '命令面板' })).toBeNull();
    fireEvent.click(cmdBtn);
    expect(screen.getByRole('dialog', { name: '命令面板' })).toBeInTheDocument();
  });

  it('Ctrl+K shortcut opens the CommandPalette (H05 keyboard path)', () => {
    renderRootLayout('/');
    expect(screen.queryByRole('dialog', { name: '命令面板' })).toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(screen.getByRole('dialog', { name: '命令面板' })).toBeInTheDocument();
  });

  // SIK-121 W2.5 — visual contract Acceptance Hook H12 (brand mark + collapsed
  // wordmark). See docs/plan/sik-rail-v5-visual-contract.md §7 H12.

  it('rail brand renders the inline BrandMark SVG (H12 — favicon SSOT)', () => {
    renderRootLayout('/');
    const mark = screen.getByTestId('rail-brand-mark');
    const svg = mark.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 40 40');
    expect(svg?.getAttribute('width')).toBe('28');
    expect(svg?.getAttribute('height')).toBe('28');
    expect(svg?.querySelectorAll('line')).toHaveLength(6);
    expect(svg?.querySelectorAll('circle')).toHaveLength(1);
  });

  it('rail brand never renders the legacy 12×12 .brandDot affordance (W1 drift cleanup)', () => {
    renderRootLayout('/');
    const mark = screen.getByTestId('rail-brand-mark');
    expect(mark.className).not.toMatch(/brandDot/);
  });
});
