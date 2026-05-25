import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from './RootLayout';

/*
 * RootLayout tests — V5 §D.4 SaaS shell.
 *
 * SIK-121 W1: 4-tab nav [首页/练习/复盘/笔记] + Me entry exclusively
 * via the RailMe avatar slot. See
 * docs/plan/sik-rail-v5-visual-contract.md §1–§2 + Acceptance Hooks
 * H01/H02. The 5-tab variant is gone; any future Tab1 issue must read
 * the rendered RootLayout (not the prototype HTML) for tab count.
 */

beforeEach(() => {
  // Rail's collapse state machine reads localStorage on mount; keep tests
  // deterministic.
  window.localStorage.clear();
});

afterEach(() => {
  // Rail.tsx writes document.documentElement.dataset.rail on mount; clean
  // up to avoid leaking state into adjacent test files (vitest worker
  // shares the jsdom instance across files in a single thread).
  document.documentElement.removeAttribute('data-rail');
});

function makeRouter(path: string) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <div data-testid="route-home">HOME</div> },
          { path: 'practice', element: <div data-testid="route-practice">PRACTICE</div> },
          { path: 'me', element: <div data-testid="route-me">ME</div> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
}

function makeRouterWithUser(path: string) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <RootLayout
            user={{
              displayName: 'lhr',
              subtitle: 'Lv.4 学习达人',
            }}
          />
        ),
        children: [
          { index: true, element: <div data-testid="route-home">HOME</div> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
}

describe('RootLayout (V5 §D.4 SaaS shell)', () => {
  it('wraps every page in AppShell with Rail (desktop) + Workspace + Outlet', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.getByTestId('route-home').textContent).toBe('HOME');
  });

  it('renders Rail with the SIK-121 4-tab nav order [首页, 练习, 复盘, 笔记] (no 我的)', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    const navLinks = screen
      .getAllByRole('link')
      .filter((el) => el.dataset.testid === undefined);
    // First N links inside the rail are the fixed nav items. Filter out
    // the "我的" link (carries data-testid='rail-me-link') and any
    // outside-rail links the route subtree might add.
    const labels = navLinks
      .slice(0, 4)
      .map((el) => el.getAttribute('aria-label') ?? el.textContent);
    expect(labels).toEqual(['首页', '练习', '复盘', '笔记']);
  });

  it('does NOT render 我的 in the rail nav row (Me lives in RailMe avatar)', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    const navLinks = screen
      .getAllByRole('link')
      .filter((el) => el.dataset.testid === undefined);
    const labels = navLinks
      .slice(0, 4)
      .map((el) => el.getAttribute('aria-label') ?? el.textContent);
    expect(labels).not.toContain('我的');
  });

  it('exposes Me entry exclusively through the RailMe avatar (one /me link)', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    // aria-label="我的" is the canonical Me entry marker; must be unique.
    const meEntries = screen.getAllByLabelText('我的');
    expect(meEntries).toHaveLength(1);
    expect(meEntries[0]).toHaveAttribute('href', '/me');
    expect(meEntries[0]).toHaveAttribute('data-testid', 'rail-me-link');
  });

  it('marks the active nav item via data-active when its path matches', () => {
    render(<RouterProvider router={makeRouter('/practice')} />);
    const practiceLink = screen.getAllByRole('link').find((el) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').includes('练习'),
    );
    expect(practiceLink?.dataset.active).toBe('true');
  });

  it('RailMe expanded slot renders Avatar + meName + meSub when user prop given', () => {
    render(<RouterProvider router={makeRouterWithUser('/')} />);
    expect(screen.getByText('lhr')).toBeInTheDocument();
    expect(screen.getByText('Lv.4 学习达人')).toBeInTheDocument();
  });

  it('RailMe falls back to placeholder name + subtitle when user prop omitted', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    // displayName falls back to "我" and subtitle to "Lv.4 学习达人".
    // Note: Avatar fallback also renders "我" inside the avatar circle,
    // so getByText('我') would find 2 nodes. Anchor on the meSub text
    // (unique) and assert the meName via the rail-me-link subtree.
    expect(screen.getByText('Lv.4 学习达人')).toBeInTheDocument();
    const meEntry = screen.getByTestId('rail-me-link');
    // meName is the <span class={meName}> child; use inner-text query.
    expect(meEntry.textContent).toContain('我');
    expect(meEntry.textContent).toContain('Lv.4 学习达人');
  });

  it('RailMe link carries data-tip="我的" so collapsed-state CSS ::after Tooltip activates', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    const meEntry = screen.getByTestId('rail-me-link');
    expect(meEntry).toHaveAttribute('data-tip', '我的');
  });
});
