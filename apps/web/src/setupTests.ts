// Vitest setup — registered via vitest.config.ts setupFiles.
//
// 1) jest-dom matchers — RTL queries 出来的 DOM node 要走 toBeInTheDocument()
//    / toHaveClass() / 等扩展才能可读断言。
// 2) MSW v2 server lifecycle — before/after hooks 让 view tests 拿到 mocked
//    /api/v2/* 而不要打真后端。in-test 用 server.use(...) override per-case。
// 3) failOnConsole — React warning（key 重复 / act() 包裹缺失 / unstable nesting）
//    会走 console.error 但不会让 test fail。我们把这些升级成 throw，避免假 PASS。
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './test-utils/server';

// jsdom 没实现 Element.prototype.scrollIntoView — AnswerArea 翻页副作用
// 调它会炸. 测试里我们不关心实际滚动,装个 no-op 让组件代码原样跑.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function () {};
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function () {};
}

// jsdom 默认不实现 matchMedia (Dashboard R5 hash scroll effect 调用).
// Mock 返回 matches=false (即非 prefers-reduced-motion), 让组件代码不崩.
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

// jsdom 默认不实现 IntersectionObserver (useScrollSpyTab Result tab nav 调用).
// Mock 成 no-op class 让 hook useEffect `new IntersectionObserver(...)` 不抛;
// 测试不依赖真实滚动观察, 走 useScrollSpyTab 默认 activeId 即可.
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

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// React DevWarn 升级为 fail：再加白名单时按需扩展，但默认对 key/act/PropTypes 都拦。
const REACT_FAIL_PATTERNS = [
  'Encountered two children with the same key',
  'Each child in a list should have a unique "key"',
  'Warning: An update to ',
  'not wrapped in act(',
];

beforeEach(() => {
  const realError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    realError(...(args as Parameters<typeof console.error>));
    if (REACT_FAIL_PATTERNS.some((p) => msg.includes(p))) {
      throw new Error(`Unexpected console.error: ${msg.slice(0, 200)}`);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
