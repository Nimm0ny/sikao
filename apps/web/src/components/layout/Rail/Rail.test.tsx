import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Rail } from './Rail';
import type { RailNavItem } from './Rail';

/*
 * Rail tests — V5 D.3.32 layout.
 * Why: cover the §C.4.3 collapse state machine surface (data-collapsed attr),
 *      the controlled prop path (onCollapseChange), Ctrl+\ shortcut, and the
 *      collapsed-brand expand affordance. We assert via data-* attrs because
 *      jsdom can't compute the --rail-w* token-driven pixel widths from
 *      tokens.css; the data-collapsed attr is the test-stable contract.
 */

const navItems: RailNavItem[] = [
  { id: 'home', icon: <svg data-testid="home-icon" />, label: '首页', href: '/', active: true },
  { id: 'practice', icon: <svg data-testid="practice-icon" />, label: '练习', href: '/practice' },
];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  document.documentElement.removeAttribute('data-rail');
});

describe('Rail', () => {
  it('renders collapsed (data-collapsed) when controlled collapsed=true', () => {
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={true}
      />,
    );
    expect(screen.getByTestId('rail')).toHaveAttribute('data-collapsed', 'true');
    // collapsed brand rendered as a button (click expands)
    expect(screen.getByTestId('rail-brand-collapsed')).toBeInTheDocument();
    // toggle button hidden in collapsed state
    expect(screen.queryByTestId('rail-toggle')).toBeNull();
  });

  it('renders expanded (no data-collapsed) when controlled collapsed=false', () => {
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    expect(screen.getByTestId('rail')).not.toHaveAttribute('data-collapsed');
    expect(screen.getByTestId('rail-brand')).toBeInTheDocument();
    expect(screen.getByTestId('rail-toggle')).toBeInTheDocument();
  });

  it('toggle button click fires onCollapseChange(true)', () => {
    const onCollapseChange = vi.fn();
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={false}
        onCollapseChange={onCollapseChange}
      />,
    );
    fireEvent.click(screen.getByTestId('rail-toggle'));
    expect(onCollapseChange).toHaveBeenCalledWith(true);
  });

  it('Ctrl+\\ fires onCollapseChange (toggling current state)', () => {
    const onCollapseChange = vi.fn();
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={true}
        onCollapseChange={onCollapseChange}
      />,
    );
    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    expect(onCollapseChange).toHaveBeenCalledWith(false);
  });

  it('clicking the collapsed brand expands the rail (uncontrolled)', () => {
    // start collapsed via localStorage so initial state = collapsed
    window.localStorage.setItem('v5-rail-collapsed', 'true');
    render(
      <Rail brand={<span>BR</span>} navItems={navItems} me={<span>ME</span>} />,
    );
    expect(screen.getByTestId('rail')).toHaveAttribute('data-collapsed', 'true');
    fireEvent.click(screen.getByTestId('rail-brand-collapsed'));
    expect(screen.getByTestId('rail')).not.toHaveAttribute('data-collapsed');
    expect(window.localStorage.getItem('v5-rail-collapsed')).toBe('false');
  });

  it('marks the active navItem with data-active', () => {
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    const homeLink = screen.getByRole('link', { name: '首页' });
    expect(homeLink).toHaveAttribute('data-active', 'true');
    expect(homeLink).toHaveAttribute('aria-current', 'page');
    const practiceLink = screen.getByRole('link', { name: '练习' });
    expect(practiceLink).not.toHaveAttribute('data-active');
  });

  it('navItem onClick fires + preventDefault on plain left-click (SPA path)', () => {
    const onClick = vi.fn();
    const itemsWithClick: RailNavItem[] = [
      { id: 'home', icon: <svg />, label: '首页', href: '/', onClick },
    ];
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={itemsWithClick}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    const link = screen.getByRole('link', { name: '首页' });
    fireEvent.click(link, { button: 0 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('navItem onClick is bypassed on ctrl/meta-click (open in new tab)', () => {
    const onClick = vi.fn();
    const itemsWithClick: RailNavItem[] = [
      { id: 'home', icon: <svg />, label: '首页', href: '/', onClick },
    ];
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={itemsWithClick}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    const link = screen.getByRole('link', { name: '首页' });
    fireEvent.click(link, { button: 0, ctrlKey: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders only the navItems given — Me must come via the me slot, not nav (SIK-121 H01/H02)', () => {
    // Defensive: even if a future RootLayout refactor accidentally
    // re-introduced a "我的" navItem, this test would not catch it
    // (Rail forwards what it gets). But asserting Rail's separation of
    // the `me` slot from `navItems` documents the contract surface.
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<a data-testid="me-slot" aria-label="我的" href="/me">ME</a>}
        collapsed={false}
      />,
    );
    // The me slot is rendered (separate from nav)
    expect(screen.getByTestId('me-slot')).toBeInTheDocument();
    // No nav-list <li> contains the "我的" link — only the me slot does
    const navList = screen.getAllByRole('list')[0];
    const meEntriesInsideNav = navList.querySelectorAll('[aria-label="我的"]');
    expect(meEntriesInsideNav).toHaveLength(0);
  });

  // SIK-121 W2 — visual contract Acceptance Hooks H05-H10 + Tooltip pattern unify.
  // See docs/plan/sik-rail-v5-visual-contract.md §6.

  it('cmd slot renders inside Rail when provided (H05 surface)', () => {
    // RootLayout owns the cmd-k button content; Rail just exposes the slot.
    render(
      <Rail
        brand={<span>BR</span>}
        cmd={<button type="button" data-testid="rail-cmd-btn">cmd</button>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    expect(screen.getByTestId('rail-cmd-btn')).toBeInTheDocument();
  });

  it('toggle button sits inside the brand row trailing (H07)', () => {
    // The toggle button must be a descendant of the brand row, not a
    // bottom-of-rail sibling. We assert this by querying the brand
    // container and checking the toggle is inside it.
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    const brand = screen.getByTestId('rail-brand');
    expect(brand.querySelector('[data-testid="rail-toggle"]')).not.toBeNull();
  });

  it('section heading "导航" renders in expanded state (H10)', () => {
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    // Use exact text match; RTL falls back to text node descendant.
    expect(screen.getByText('导航')).toBeInTheDocument();
  });

  it('navItem in collapsed state carries data-tip attribute equal to label (Tooltip mode unify)', () => {
    // W1 RailMe used [data-tip]::after; W2 unifies brand + nav onto the
    // same pure-CSS pattern. The React <Tooltip> component is no longer
    // wrapped around collapsed brand / nav rows.
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={true}
      />,
    );
    const homeLink = screen.getByRole('link', { name: '首页' });
    expect(homeLink).toHaveAttribute('data-tip', '首页');
    const practiceLink = screen.getByRole('link', { name: '练习' });
    expect(practiceLink).toHaveAttribute('data-tip', '练习');
  });

  it('collapsed brand button carries data-tip for ::after Tooltip (Tooltip mode unify)', () => {
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={true}
      />,
    );
    const brandBtn = screen.getByTestId('rail-brand-collapsed');
    expect(brandBtn).toHaveAttribute('data-tip');
    expect(brandBtn.getAttribute('data-tip')).toMatch(/展开侧栏/);
  });

  it('toggle button uses sprite (rail-toggle) — no inline path elements (H06)', () => {
    // H06 mandates SpriteIcon usage. The sprite consumer renders
    // <svg><use href="/icons.svg#rail-toggle" /></svg>; we assert the
    // <use> child exists and the inline geometry path is gone.
    render(
      <Rail
        brand={<span>BR</span>}
        navItems={navItems}
        me={<span>ME</span>}
        collapsed={false}
      />,
    );
    const toggle = screen.getByTestId('rail-toggle');
    const useEl = toggle.querySelector('use');
    expect(useEl).not.toBeNull();
    expect(useEl?.getAttribute('href')).toBe('/icons.svg#rail-toggle');
  });
});
