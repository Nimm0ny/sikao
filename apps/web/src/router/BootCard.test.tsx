/*
 * BootCard tests — SIK-89 Home M-Auth wave 2 (2026-05-24).
 *
 * Cover the five branches:
 *   1. ?reason=missing-route        → "页面未找到"
 *   2. ?reason=coming-soon-practice → "答题功能即将上线"
 *   3. ?reason=coming-soon-review   → "题目复盘页即将上线"
 *   4. ?reason=coming-soon-notes    → "笔记功能即将上线"
 *   5. unknown / missing reason     → generic V5 boot copy
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { BootCard } from './BootCard';

function renderAt(initialEntry: string) {
  const router = createMemoryRouter(
    [{ path: '/*', element: <BootCard /> }],
    { initialEntries: [initialEntry] },
  );
  return render(<RouterProvider router={router} />);
}

describe('BootCard reason switch', () => {
  it('renders missing-route copy', () => {
    renderAt('/anything?reason=missing-route');
    expect(screen.getByRole('heading')).toHaveTextContent('页面未找到');
    expect(screen.getByTestId('boot-card')).toHaveTextContent(/不在当前可用的路由列表/);
  });

  it('renders coming-soon-practice copy', () => {
    renderAt('/anything?reason=coming-soon-practice');
    expect(screen.getByRole('heading')).toHaveTextContent('答题功能即将上线');
    expect(screen.getByTestId('boot-card')).toHaveTextContent(/Practice M-Session/);
  });

  it('renders coming-soon-review copy', () => {
    renderAt('/anything?reason=coming-soon-review');
    expect(screen.getByRole('heading')).toHaveTextContent('题目复盘页即将上线');
    expect(screen.getByTestId('boot-card')).toHaveTextContent(/Review M-Hub/);
  });

  it('renders coming-soon-notes copy', () => {
    renderAt('/anything?reason=coming-soon-notes');
    expect(screen.getByRole('heading')).toHaveTextContent('笔记功能即将上线');
    expect(screen.getByTestId('boot-card')).toHaveTextContent(/Note M-Editor/);
  });

  it('falls back to generic copy when reason is missing', () => {
    renderAt('/anything');
    expect(screen.getByRole('heading')).toHaveTextContent('Sikao V5-M3.5 boot');
    expect(screen.getByTestId('boot-card')).toHaveTextContent(/V5-M3\.5 wave 16/);
  });

  it('falls back to generic copy when reason is unknown', () => {
    renderAt('/anything?reason=bogus-value');
    expect(screen.getByRole('heading')).toHaveTextContent('Sikao V5-M3.5 boot');
  });
});
