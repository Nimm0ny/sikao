import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileAppShell } from './MobileAppShell';

/*
 * MobileAppShell tests — V5 D.3.32+ mobile chrome.
 * Why: cover the slot mux (topbar / main / bottomNav) and confirm the main
 *      surface lands as a <main> landmark. Pixel heights flow through
 *      --mobile-topbar-h / --mobile-bottom-nav-h tokens which jsdom can't
 *      resolve, so we assert via DOM structure + data-testid contracts.
 */

describe('MobileAppShell', () => {
  it('renders main + topbar + bottomNav slots when all provided', () => {
    render(
      <MobileAppShell
        topbar={<header data-testid="tb">TB</header>}
        bottomNav={<nav data-testid="nv">NV</nav>}
      >
        <p>content</p>
      </MobileAppShell>,
    );
    expect(screen.getByTestId('mobile-app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-app-shell-topbar')).toContainElement(
      screen.getByTestId('tb'),
    );
    expect(screen.getByTestId('mobile-app-shell-bottom')).toContainElement(
      screen.getByTestId('nv'),
    );
    const main = screen.getByTestId('mobile-app-shell-main');
    expect(main.tagName.toLowerCase()).toBe('main');
    expect(main).toHaveTextContent('content');
  });

  it('drops topbar / bottomNav slots from the tree when omitted', () => {
    render(
      <MobileAppShell>
        <p>only-content</p>
      </MobileAppShell>,
    );
    expect(screen.queryByTestId('mobile-app-shell-topbar')).toBeNull();
    expect(screen.queryByTestId('mobile-app-shell-bottom')).toBeNull();
    expect(screen.getByTestId('mobile-app-shell-main')).toHaveTextContent(
      'only-content',
    );
  });

  it('renders topbar without bottomNav when only one slot is passed', () => {
    render(
      <MobileAppShell topbar={<header data-testid="tb">TB</header>}>
        <p>x</p>
      </MobileAppShell>,
    );
    expect(screen.getByTestId('mobile-app-shell-topbar')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-app-shell-bottom')).toBeNull();
  });
});
