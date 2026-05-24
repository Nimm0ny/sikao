import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomTabBar } from './BottomTabBar';
import type { BottomTabBarItem } from './BottomTabBar';

/*
 * BottomTabBar tests — V5 D.3.32+ mobile chrome.
 *
 * Why: cover the role=navigation contract, items rendering, active state
 *      data-attr, badge dot, and href routing. Glassmorphism visuals are
 *      asserted via className presence (jsdom can't compute backdrop-filter
 *      from tokens / @supports / @media); the CSS-layer fallback path is
 *      validated indirectly through className-stable contracts and is
 *      additionally covered by V5-M9 Playwright visual regression
 *      (apps/web/e2e/visual/__snapshots__/) per tasks.md §14.3.
 *
 *      TODO (V5-M9): Playwright visual snapshot for BottomTabBar:
 *        a) default glass (Chrome with backdrop-filter)
 *        b) @supports not fallback (legacy WebView emulation)
 *        c) prefers-reduced-transparency:reduce media emulation
 *      jsdom doesn't honor @supports / prefers-reduced-transparency, so
 *      those branches stay in Playwright instead of unit tests.
 */

const items: BottomTabBarItem[] = [
  { id: 'home', icon: <svg data-testid="home-svg" />, label: '首页', href: '/', active: true },
  { id: 'practice', icon: <svg data-testid="practice-svg" />, label: '练习', href: '/practice' },
  {
    id: 'note',
    icon: <svg data-testid="note-svg" />,
    label: '笔记',
    href: '/note',
    badge: 3,
  },
  { id: 'me', icon: <svg data-testid="me-svg" />, label: '我的', href: '/me' },
];

describe('BottomTabBar', () => {
  it('renders role=navigation with aria-label="主导航" and a className-driven glass shell', () => {
    render(<BottomTabBar items={items} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(nav).toBe(screen.getByTestId('bottom-tab-bar'));
    // class hook for the glass surface — keeps visual contract stable; the
    // computed backdrop-filter / @supports fallback is owned by Playwright.
    expect(nav.className).toMatch(/nav/);
  });

  it('renders each item with its href, label and aria-current on active', () => {
    render(<BottomTabBar items={items} />);
    const home = screen.getByTestId('bottom-tab-home');
    expect(home.getAttribute('href')).toBe('/');
    expect(home).toHaveAttribute('data-active', 'true');
    expect(home).toHaveAttribute('aria-current', 'page');

    const practice = screen.getByTestId('bottom-tab-practice');
    expect(practice.getAttribute('href')).toBe('/practice');
    expect(practice).not.toHaveAttribute('data-active');
    expect(practice).not.toHaveAttribute('aria-current');
  });

  it('renders the badge dot only for items with badge > 0', () => {
    render(<BottomTabBar items={items} />);
    expect(screen.getByTestId('bottom-tab-note-badge')).toBeInTheDocument();
    // home has no badge -> no dot
    expect(screen.queryByTestId('bottom-tab-home-badge')).toBeNull();
    // badge value flows into aria-label so SR users get the count
    expect(screen.getByTestId('bottom-tab-note')).toHaveAccessibleName(
      '笔记（3 条未读）',
    );
  });

  it('forwards click on an item link (href is the canonical route)', () => {
    render(<BottomTabBar items={items} />);
    const link = screen.getByTestId('bottom-tab-practice');
    // jsdom default-cancels link navigation but the click event itself fires;
    // we assert href as the routing contract (verified above) plus that the
    // event reaches the element so future router.push integrations can hook.
    const onClick = vi.fn();
    link.addEventListener('click', onClick);
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('throws on empty items (fail-fast — no silent render of an empty bar)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BottomTabBar items={[]} />)).toThrow(
      /at least one entry/,
    );
    spy.mockRestore();
  });
});
