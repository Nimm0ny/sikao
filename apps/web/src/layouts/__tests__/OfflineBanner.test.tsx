import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineBanner } from '../OfflineBanner';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    setOnline(true);
  });

  it('renders nothing while online', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('renders banner with copy when offline', () => {
    setOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByTestId('offline-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('当前离线');
  });

  it('uses role=status + aria-live=polite for screen readers', () => {
    setOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByTestId('offline-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('reacts to offline / online events without re-mount', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
});
