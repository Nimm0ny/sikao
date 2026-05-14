import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import Marketing from '../marketing/Marketing';

// jsdom 不带 IntersectionObserver, 默认 mock 让 Stats useEffect 不抛.
// (单独 describe 用更精细 mock 检验 entry 触发.)
beforeAll(() => {
  if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
    class DefaultMockIO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: DefaultMockIO,
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: DefaultMockIO,
    });
  }
});

describe('Marketing landing V1', () => {
  it('renders hero + chip + main sections', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    expect(screen.getByText('2026 国考大纲已对齐 · 申论批改建议')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /让备考从刷题/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '三步开始你的备考' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '备考需要的，都在一个地方' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /你想问的/ })).toBeInTheDocument();
    expect(screen.getByTestId('marketing-cta-start')).toHaveTextContent('开始免费练习');
    expect(screen.getByTestId('marketing-cta-login')).toHaveTextContent('登录');
    expect(screen.getByTestId('marketing-cta-signup')).toHaveTextContent('免费试用');
    expect(screen.getByTestId('marketing-cta-start')).toHaveAttribute('href', '/register/email');
    expect(screen.getByTestId('marketing-cta-signup')).toHaveAttribute('href', '/register/email');
  });

  it('keeps user-facing copy in product language', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    const blockedTerms = ['AI', 'LLM', 'Pro', '模型', '智能评分', '暗朴', '朱红', '#9B2F2F'];
    const visibleCopy = document.body.textContent ?? '';
    for (const term of blockedTerms) {
      expect(visibleCopy).not.toContain(term);
    }
  });

  it('switches preview tabs and updates URL bar with tabpanel a11y', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    expect(screen.getByText(/言语理解 · 真题示例/)).toBeInTheDocument();

    const tabShu = screen.getByTestId('marketing-preview-tab-shu');
    expect(tabShu).toHaveAttribute('aria-controls', 'pv-panel-shu');
    expect(tabShu).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(tabShu);
    expect(screen.getByText(/数量关系 · 真题示例/)).toBeInTheDocument();
    expect(tabShu).toHaveAttribute('aria-selected', 'true');

    const panel = document.getElementById('pv-panel-shu');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'pv-tab-shu');
  });

  it('shows pricing tiers and beta banner', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    expect(screen.getByText('Beta · 邀请制')).toBeInTheDocument();
    expect(screen.getByText('月度会员')).toBeInTheDocument();
    expect(screen.getByText('季度会员')).toBeInTheDocument();
    expect(screen.getByText('年度会员')).toBeInTheDocument();
    expect(screen.getByText('查看完整功能对比')).toBeInTheDocument();
  });

  it('opens FAQ details on click', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    const summary = screen.getByTestId('marketing-faq-q-0');
    expect(summary).toHaveTextContent('解析问答会不会答错？');
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/思考目前是公开测试/)).toBeInTheDocument();
  });

  it('renders invite section replacing testimonials', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    expect(screen.getByText('Beta 公测 · 首发邀请')).toBeInTheDocument();
    expect(screen.getByTestId('marketing-invite-cta-apply')).toHaveTextContent('申请加入 beta');
    expect(screen.getByTestId('marketing-invite-cta-feedback')).toHaveTextContent('提交反馈');
  });

  it('opens compare table and reveals 8 tbody rows', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    const summary = screen.getByText('查看完整功能对比');
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);

    const table = details.querySelector('table');
    expect(table).not.toBeNull();
    const tbodyRows = table!.querySelectorAll('tbody tr');
    expect(tbodyRows).toHaveLength(8);
    expect(within(details).getByText('解析问答')).toBeInTheDocument();
    expect(within(details).getByText(/合计/)).toBeInTheDocument();
    expect(within(details).getByText(/¥1,056/)).toBeInTheDocument();
  });
});

describe('Marketing answer typing animation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('types answer msg char-by-char then swaps to mark-highlighted HTML', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });

    // Initial: typing not yet started (240ms initial delay)
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // After 50ms: still empty cursor only

    // Advance past initial delay + full plain text typing.
    // Plain text length is ~85 chars × 22ms + 240ms initial + 80ms meta delay ≈ 2.2s.
    // 4s buffer comfortably covers.
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // After typing complete, mark highlight should appear
    const marks = document.querySelectorAll('.bg-warn-bg.rounded.px-1');
    expect(marks.length).toBeGreaterThan(0);

    // Meta line should have opacity 1 (revealed)
    const metaLine = document.querySelector('[class*="border-dashed"]') as HTMLElement | null;
    expect(metaLine).not.toBeNull();
  });
});

describe('Marketing Stats count-up', () => {
  let observerCallback: IntersectionObserverCallback | null = null;
  const observed = new Set<Element>();

  beforeEach(() => {
    observerCallback = null;
    observed.clear();
    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
      observe(el: Element): void {
        observed.add(el);
      }
      unobserve(el: Element): void {
        observed.delete(el);
      }
      disconnect(): void {
        observed.clear();
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: MockIntersectionObserver,
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: MockIntersectionObserver,
    });
  });

  it('reveals targets when stats enter viewport', () => {
    renderWithProviders(<Marketing />, { initialEntries: ['/'] });
    expect(observerCallback).not.toBeNull();

    const targets = Array.from(observed) as HTMLElement[];
    expect(targets.length).toBe(3);

    // Fake "isIntersecting" entries
    const entries = targets.map((target) => ({
      isIntersecting: true,
      target,
      time: 0,
      rootBounds: null,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      intersectionRatio: 1,
    })) as unknown as IntersectionObserverEntry[];
    observerCallback!(entries, {} as IntersectionObserver);

    // count-up uses requestAnimationFrame; ending value = target string per animateCountUp
    // Synchronous 检查 elements 仍在 doc + 含 stat label (V2: 量词 unit 跟 target 同行，label 改去掉量词头字)
    expect(screen.getByText('真题 · 国考 / 省考 / 事业编')).toBeInTheDocument();
    expect(screen.getByText('已解析题目')).toBeInTheDocument();
    expect(screen.getByText('真题覆盖 · 2013–2025')).toBeInTheDocument();
    // 量词 unit 渲染 (新增字段)
    expect(screen.getByText('套')).toBeInTheDocument();
    expect(screen.getByText('道')).toBeInTheDocument();
    expect(screen.getByText('年')).toBeInTheDocument();
  });
});
