import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from './RootLayout';

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

describe('RootLayout (V5 §D.4 SaaS shell)', () => {
  it('wraps every page in AppShell with Rail (desktop) + Workspace + Outlet', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.getByTestId('route-home').textContent).toBe('HOME');
  });

  it('renders Rail with the spec-fixed nav order [首页, 练习, 复盘, 笔记, 我的]', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    const navLinks = screen
      .getAllByRole('link')
      .filter((el) => el.dataset.testid === undefined);
    // First 5 links inside the rail are the fixed nav items.
    const labels = navLinks.slice(0, 5).map((el) => el.getAttribute('aria-label') ?? el.textContent);
    // SIK-93 Home M-Records: 题库 entry was removed; 我的 takes the 5th
    // slot (题库 interactions land in Review M-Hub QuestionHub).
    expect(labels).toEqual(['首页', '练习', '复盘', '笔记', '我的']);
  });

  it('marks the active nav item via data-active when its path matches', () => {
    render(<RouterProvider router={makeRouter('/practice')} />);
    const practiceLink = screen.getAllByRole('link').find((el) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').includes('练习'),
    );
    expect(practiceLink?.dataset.active).toBe('true');
  });

  it('exposes a /me link via the RailMe avatar slot (not in navItems)', () => {
    render(<RouterProvider router={makeRouter('/')} />);
    const meLink = screen.getByTestId('rail-me-link');
    expect(meLink.getAttribute('href')).toBe('/me');
  });
});
