import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileTopBar } from './MobileTopBar';

/*
 * MobileTopBar tests — V5 D.3.32+ mobile chrome.
 * Why: cover the role=banner landmark contract, the title h1 + leading /
 *      trailing slot wells, and the title-spacer fallback when no title is
 *      passed (so leading / trailing alignment doesn't collapse).
 */

describe('MobileTopBar', () => {
  it('renders <header role="banner"> with title h1 and leading + trailing slots', () => {
    render(
      <MobileTopBar
        title="练习"
        leading={<button>返回</button>}
        trailing={<button>更多</button>}
      />,
    );
    const banner = screen.getByRole('banner');
    expect(banner).toBe(screen.getByTestId('mobile-topbar'));
    expect(screen.getByRole('heading', { level: 1, name: '练习' })).toBeInTheDocument();
    expect(screen.getByTestId('mobile-topbar-leading')).toContainElement(
      screen.getByRole('button', { name: '返回' }),
    );
    expect(screen.getByTestId('mobile-topbar-trailing')).toContainElement(
      screen.getByRole('button', { name: '更多' }),
    );
  });

  it('omits the title h1 when no title is passed (uses spacer)', () => {
    render(<MobileTopBar />);
    expect(screen.queryByTestId('mobile-topbar-title')).toBeNull();
    // banner still mounts so AppShell layout doesn't shift
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders empty leading / trailing slots when those are omitted', () => {
    render(<MobileTopBar title="t" />);
    const leading = screen.getByTestId('mobile-topbar-leading');
    const trailing = screen.getByTestId('mobile-topbar-trailing');
    expect(leading).toBeEmptyDOMElement();
    expect(trailing).toBeEmptyDOMElement();
  });
});
