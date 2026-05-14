import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { TabletShell } from '../TabletShell';
import { AsideOutletProvider } from '../../AsideOutlet';
import { useAsideSet } from '../../useAsideOutlet';

/**
 * TabletShell (PR7 + PR11) — orientation dispatch + 三栏 landscape Aside.
 *
 * 测试范围:
 *   1. portrait: RailMini 渲染 + AsideBottomBar 路由 gate (非答题 view 0 渲染)
 *   2. landscape: DesktopShell + Aside 容器渲染; panels 缺失 → Aside 退场
 *   3. landscape + 注入 panel: Aside 显示 + 默认 analysis tab active
 *
 * 不测的:
 *   - useDevice 分发 (AppShell.test.tsx 覆盖)
 *   - framer-motion 视觉 (jsdom 不真合成 transitionend)
 *   - Sidebar 内部业务 (DesktopShell 由 AppShell.test 覆盖, 这里只验存在)
 */

const matchMediaMock = (orientation: 'portrait' | 'landscape') => {
  return (query: string): MediaQueryList => {
    const matches =
      orientation === 'portrait'
        ? query.includes('(orientation: portrait)')
        : !query.includes('(orientation: portrait)');
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  };
};

function PanelInjector({ children }: { readonly children: ReactNode }) {
  // 注入一个 analysis panel 让 Aside 在 landscape 显示.
  useAsideSet('analysis', <div data-testid="injected-analysis">解析内容</div>);
  return <>{children}</>;
}

const renderShell = (
  orientation: 'portrait' | 'landscape',
  injectPanel: boolean = false,
  initialEntries: readonly string[] = ['/dashboard'],
) => {
  // matchMedia mock 必须在 render 前装 (useSyncExternalStore 立刻读 readOrientation).
  vi.stubGlobal('matchMedia', matchMediaMock(orientation));
  const PageInner = injectPanel ? (
    <PanelInjector>
      <div data-testid="page-content">page</div>
    </PanelInjector>
  ) : (
    <div data-testid="page-content">page</div>
  );
  return renderWithProviders(
    <AsideOutletProvider>
      <Routes>
        <Route element={<TabletShell />}>
          <Route path="/dashboard" element={PageInner} />
          <Route path="/practice/sessions/123" element={PageInner} />
        </Route>
      </Routes>
    </AsideOutletProvider>,
    { initialEntries },
  );
};

describe('TabletShell · orientation dispatch (PR7 + PR11)', () => {
  beforeEach(() => {
    // jsdom 不内置 ResizeObserver, framer-motion 在 useSyncExternalStore 间接需要.
    if (!window.ResizeObserver) {
      window.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }));
    }
  });

  it('portrait mode renders RailMini + tablet-shell-p marker', () => {
    renderShell('portrait');
    expect(screen.getByTestId('rail-mini')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    // landscape marker 不应出现
    expect(screen.queryByTestId('tablet-aside')).not.toBeInTheDocument();
  });

  it('portrait mode hides AsideBottomBar on non-practice route (dashboard)', () => {
    renderShell('portrait', false, ['/dashboard']);
    // /dashboard 不在 PRACTICE_PATH_PREFIXES, AsideBottomBar 内部 return null.
    expect(screen.queryByTestId('aside-bottom-bar')).not.toBeInTheDocument();
  });

  it('landscape mode renders tablet-shell-l layout (DesktopShell + Aside slot)', () => {
    renderShell('landscape');
    // tablet-shell-l data-shell marker
    const shell = document.querySelector('[data-shell="tablet-landscape"]');
    expect(shell).not.toBeNull();
    // DesktopShell 内部 sidebar 标记
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('landscape mode: panels 空 → Aside 不渲染 (auto-退场)', () => {
    // 没有 useAsideSet 注入 → Aside return null.
    renderShell('landscape', false);
    expect(screen.queryByTestId('tablet-aside')).not.toBeInTheDocument();
  });

  it('landscape mode: 注入 analysis panel → Aside 渲染 + analysis tab default active', () => {
    renderShell('landscape', true);
    const aside = screen.getByTestId('tablet-aside');
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveAttribute('aria-label', '解析 / 笔记 / AI');
    // analysis tab 默认 active (panels 中第一个非空 key)
    expect(screen.getByTestId('tablet-aside-tab-analysis')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // panel 内容渲染
    expect(screen.getByTestId('injected-analysis')).toBeInTheDocument();
  });
});
