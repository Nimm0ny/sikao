/*
 * Vitest setup — registered via vitest.config.ts setupFiles.
 *
 * V5-M0.5 skeleton (2026-05-24): jest-dom matchers + jsdom polyfills only.
 * V4 MSW handlers + renderWithProviders + REACT_FAIL_PATTERNS were dropped
 * with apps/web/src/test-utils/**. They will be reintroduced in V5-M3
 * (component test infrastructure) and V5-M9 (page integration tests),
 * sourced from @sikao/test-utils (tests/fixtures/*) when needed.
 */
import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView / scrollTo. Component tests that
// trigger DOM scroll side-effects need these as no-ops or they throw.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function () {};
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function () {};
}

// jsdom does not implement matchMedia. prefers-reduced-motion / hover capability
// queries default to matches=false (closest to a typical desktop user).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
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

// jsdom does not implement IntersectionObserver. Component tests that mount
// scroll-spy or virtualization hooks rely on this no-op stub.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}
