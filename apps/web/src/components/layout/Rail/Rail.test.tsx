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
});
