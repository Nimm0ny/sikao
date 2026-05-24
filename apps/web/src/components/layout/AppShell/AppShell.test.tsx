import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';

/*
 * AppShell tests — V5 D.3.32 layout.
 * Why: cover the matchMedia-driven mobile/desktop slot mux. matchMedia is
 *      polyfilled in setupTests.ts; we replace its impl per test case to
 *      simulate mobile (<768) vs desktop. The desktop case asserts rail +
 *      children are rendered while topbar/bottomNav slots are dropped from
 *      the tree; the mobile case asserts the inverse.
 */

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

afterEach(() => {
  setMatchMedia(() => false); // reset to desktop default
});

describe('AppShell', () => {
  it('renders rail + children on desktop and hides topbar/bottomNav', () => {
    setMatchMedia(() => false); // not mobile
    render(
      <AppShell
        rail={<aside data-testid="rail-slot">RAIL</aside>}
        topbar={<div data-testid="topbar-slot">TOP</div>}
        bottomNav={<nav data-testid="bottom-slot">BOT</nav>}
      >
        <div data-testid="content">CONTENT</div>
      </AppShell>,
    );
    expect(screen.getByTestId('rail-slot')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByTestId('topbar-slot')).toBeNull();
    expect(screen.queryByTestId('bottom-slot')).toBeNull();
  });

  it('hides rail and renders topbar + bottomNav on mobile (<768)', () => {
    setMatchMedia((q) => q.includes('max-width: 767.98px'));
    render(
      <AppShell
        rail={<aside data-testid="rail-slot">RAIL</aside>}
        topbar={<div data-testid="topbar-slot">TOP</div>}
        bottomNav={<nav data-testid="bottom-slot">BOT</nav>}
      >
        <div data-testid="content">CONTENT</div>
      </AppShell>,
    );
    expect(screen.queryByTestId('rail-slot')).toBeNull();
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-slot')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-slot')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-mobile', 'true');
  });

  it('renders only children when no slot props are passed', () => {
    setMatchMedia(() => false);
    render(
      <AppShell>
        <div data-testid="content">CONTENT</div>
      </AppShell>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByTestId('topbar-slot')).toBeNull();
    expect(screen.queryByTestId('bottom-slot')).toBeNull();
  });
});
