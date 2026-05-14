import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import ShenlunSession from './ShenlunSession';

// ShenlunSession dispatcher tests (PR13 P1, 2026-05-13).
//
// We exercise the three branches by stubbing innerWidth + matchMedia
// (orientation) and dispatching resize / pen pointerdown events. The hook
// internals (debounce, key filtering) are covered separately in
// useInputMode.test.ts.

interface MatchMediaInit {
  readonly portrait: boolean;
}

function stubMatchMedia({ portrait }: MatchMediaInit): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: query.includes('portrait') ? portrait : !portrait,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function setInnerWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value });
}

function dispatchPenPointerdown(): void {
  const evt = new Event('pointerdown', { bubbles: true }) as Event & {
    pointerType?: string;
    isPrimary?: boolean;
  };
  evt.pointerType = 'pen';
  evt.isPrimary = true;
  window.dispatchEvent(evt);
}

describe('ShenlunSession (shell dispatcher)', () => {
  let originalWidth: number;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalWidth = window.innerWidth;
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    setInnerWidth(originalWidth);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('renders DesktopFallback when viewport < tablet (mobile)', () => {
    setInnerWidth(390);
    stubMatchMedia({ portrait: false });
    const { getByTestId, queryByTestId } = renderWithProviders(<ShenlunSession />);
    expect(getByTestId('shenlun-desktop-fallback')).toBeInTheDocument();
    expect(queryByTestId('shenlun-tablet-landscape')).toBeNull();
    expect(queryByTestId('shenlun-tablet-portrait')).toBeNull();
  });

  it('renders DesktopFallback when viewport ≥ desktop (1440)', () => {
    setInnerWidth(1440);
    stubMatchMedia({ portrait: false });
    const { getByTestId } = renderWithProviders(<ShenlunSession />);
    expect(getByTestId('shenlun-desktop-fallback')).toBeInTheDocument();
  });

  it('renders TabletLandscapeShell mode="typed" on tablet landscape (no pen yet)', () => {
    setInnerWidth(1194); // iPad Pro 11" landscape
    stubMatchMedia({ portrait: false });
    const { getByTestId } = renderWithProviders(<ShenlunSession />);
    const shell = getByTestId('shenlun-tablet-landscape');
    expect(shell).toBeInTheDocument();
    expect(shell.getAttribute('data-mode')).toBe('typed');
  });

  it('flips to TabletLandscapeShell mode="handwritten" after pen pointerdown', () => {
    setInnerWidth(1194);
    stubMatchMedia({ portrait: false });
    const { getByTestId } = renderWithProviders(<ShenlunSession />);
    expect(getByTestId('shenlun-tablet-landscape').getAttribute('data-mode')).toBe('typed');

    act(() => {
      dispatchPenPointerdown();
    });

    expect(getByTestId('shenlun-tablet-landscape').getAttribute('data-mode')).toBe('handwritten');
  });

  it('renders TabletPortraitShell on tablet portrait', () => {
    setInnerWidth(1024); // iPad Mini portrait edge
    stubMatchMedia({ portrait: true });
    const { getByTestId, queryByTestId } = renderWithProviders(<ShenlunSession />);
    expect(getByTestId('shenlun-tablet-portrait')).toBeInTheDocument();
    expect(queryByTestId('shenlun-tablet-landscape')).toBeNull();
  });
});
