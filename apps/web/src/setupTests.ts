/*
 * Vitest setup — registered via vitest.config.ts setupFiles.
 *
 * V5-M0.5 skeleton (2026-05-24): jest-dom matchers + jsdom polyfills.
 * SIK-89 Home M-Auth (2026-05-24): MSW node server lifecycle wired here so
 * any Tab phase test (Home M-A handlers, Practice M-Api handlers, ...)
 * gets an isolated mock network out of the box. Per-test handlers use
 * `server.use(...)` (msw API).
 */
import { afterAll, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';

// MSW lifecycle:
//   - beforeAll: start with current handler registry (fresh per file).
//   - afterEach: reset to baseline handlers so per-test overrides don't
//     leak between tests within the same file.
//   - afterAll: clean up the underlying interceptor.
//   - onUnhandledRequest 'error': fail-fast (AGENT-H7) when test code hits
//     an endpoint no handler registered. Per-Tab handlers fill the registry
//     in their feature milestones.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
