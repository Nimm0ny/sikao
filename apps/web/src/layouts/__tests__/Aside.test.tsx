import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { Aside } from '../Aside';
import { AsideOutletProvider } from '../AsideOutlet';
import { useAsideSet, type AsideKey } from '../useAsideOutlet';

/**
 * Aside (PR11 + PR14) — 平板横屏 320 常驻右侧三 tab 抽屉 + 收纳态测试.
 *
 * 测试范围:
 *   1. panels 全空 → return null (Provider 缺失 + Provider 空两种)
 *   2. panels 非空 → 渲染 aside + 默认 width 320 + aria-label
 *   3. 默认选第一个有 panel 的 tab (analysis > notes > ask)
 *   4. tab 切换: click 切 activeKey + tabpanel 内容跟随
 *   5. 缺失 panel 对应 tab disabled
 *   6. 自定义 width prop
 *   7. PR14: defaultCollapsed=true → 渲染 32px 浮条 (role=button + data-label)
 *   8. PR14: collapsed 浮条 click → 展开为 320 三 tab
 *   9. PR14: 展开态点 collapse 按钮 → 收回 32px 浮条
 *
 * 不测的:
 *   - CSS sticky 行为 (jsdom 不模拟 scroll containment, 走 chrome MCP 验视觉)
 *   - DesktopShell 集成 (TabletShell.test.tsx 覆盖)
 */

// 测试 helper: 注入 panel 节点的小组件 (复刻 PR15 useAsideSet 真实路径).
function PanelInjector({
  injects,
}: {
  readonly injects: ReadonlyArray<readonly [AsideKey, ReactNode]>;
}) {
  // 注: useAsideSet 顺序固定即可, 这里 3 次 inject 全走 effect dep array.
  // 用静态展开避免 react-hooks/rules-of-hooks 在 .map 内 call hook 报错.
  const [a, b, c] = [
    injects.find(([k]) => k === 'analysis')?.[1] ?? null,
    injects.find(([k]) => k === 'notes')?.[1] ?? null,
    injects.find(([k]) => k === 'ask')?.[1] ?? null,
  ];
  useAsideSet('analysis', a);
  useAsideSet('notes', b);
  useAsideSet('ask', c);
  return null;
}

function renderAsideWithPanels(
  injects: ReadonlyArray<readonly [AsideKey, ReactNode]>,
  asideProps: {
    readonly width?: number;
    readonly label?: string;
    readonly defaultCollapsed?: boolean;
  } = {},
) {
  return render(
    <AsideOutletProvider>
      <PanelInjector injects={injects} />
      <Aside {...asideProps} />
    </AsideOutletProvider>,
  );
}

describe('Aside (PR11 平板横屏三 tab)', () => {
  it('returns null when AsideOutletProvider is absent', () => {
    // Provider 缺失 → useAsideOutlet 返回 null → Aside 不渲染.
    const { container } = render(<Aside />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when panels are all empty', () => {
    // Provider 存在但 caller 未注入任何 panel → panels = {} → return null.
    const { container } = render(
      <AsideOutletProvider>
        <Aside />
      </AsideOutletProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders aside with default width 320 + aria-label', () => {
    renderAsideWithPanels([
      ['analysis', <div key="a">解析内容 A</div>],
    ]);
    const aside = screen.getByTestId('tablet-aside');
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveAttribute('aria-label', '面板');
    expect(aside).toHaveStyle({ width: '320px' });
  });

  it('renders aside with custom width prop', () => {
    renderAsideWithPanels(
      [['analysis', <div key="a">解析</div>]],
      { width: 280 },
    );
    const aside = screen.getByTestId('tablet-aside');
    expect(aside).toHaveStyle({ width: '280px' });
  });

  it('uses custom label prop as aria-label', () => {
    renderAsideWithPanels(
      [['notes', <div key="n">笔记</div>]],
      { label: '解析 / 笔记 / AI' },
    );
    expect(screen.getByTestId('tablet-aside')).toHaveAttribute(
      'aria-label',
      '解析 / 笔记 / AI',
    );
  });

  it('selects first non-null panel by default (analysis > notes > ask order)', () => {
    // 同时注入 notes 跟 ask, 不注入 analysis → 默认应选 notes (第一个非空).
    renderAsideWithPanels([
      ['notes', <div key="n">笔记 panel</div>],
      ['ask', <div key="q">AI panel</div>],
    ]);
    expect(screen.getByTestId('tablet-aside-tab-notes')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('tablet-aside-panel-notes')).toHaveTextContent(
      '笔记 panel',
    );
  });

  it('renders all 3 tabs with role=tab + tablist label', () => {
    renderAsideWithPanels([
      ['analysis', <div key="a">解析</div>],
      ['notes', <div key="n">笔记</div>],
      ['ask', <div key="q">AI</div>],
    ]);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('aria-label', '解析 / 笔记 / AI');
    expect(screen.getByTestId('tablet-aside-tab-analysis')).toHaveAttribute(
      'role',
      'tab',
    );
    expect(screen.getByTestId('tablet-aside-tab-notes')).toHaveAttribute(
      'role',
      'tab',
    );
    expect(screen.getByTestId('tablet-aside-tab-ask')).toHaveAttribute(
      'role',
      'tab',
    );
  });

  it('disables tab when corresponding panel is missing', () => {
    // 只注入 analysis, notes/ask 缺失 → 对应 tab disabled.
    renderAsideWithPanels([
      ['analysis', <div key="a">解析</div>],
    ]);
    expect(screen.getByTestId('tablet-aside-tab-analysis')).not.toBeDisabled();
    expect(screen.getByTestId('tablet-aside-tab-notes')).toBeDisabled();
    expect(screen.getByTestId('tablet-aside-tab-ask')).toBeDisabled();
  });

  it('switches active tab on click + tabpanel updates', async () => {
    const user = userEvent.setup();
    renderAsideWithPanels([
      ['analysis', <div key="a">A panel</div>],
      ['notes', <div key="n">N panel</div>],
      ['ask', <div key="q">Q panel</div>],
    ]);
    // 默认 analysis active
    expect(screen.getByTestId('tablet-aside-tab-analysis')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('tablet-aside-panel-analysis')).toHaveTextContent(
      'A panel',
    );

    // 切到 notes
    await user.click(screen.getByTestId('tablet-aside-tab-notes'));
    expect(screen.getByTestId('tablet-aside-tab-notes')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('tablet-aside-tab-analysis')).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByTestId('tablet-aside-panel-notes')).toHaveTextContent(
      'N panel',
    );

    // 切到 ask
    await user.click(screen.getByTestId('tablet-aside-tab-ask'));
    expect(screen.getByTestId('tablet-aside-tab-ask')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('tablet-aside-panel-ask')).toHaveTextContent(
      'Q panel',
    );
  });

  it('tab a11y: aria-controls maps to tabpanel id', () => {
    renderAsideWithPanels([
      ['analysis', <div key="a">A</div>],
    ]);
    const tab = screen.getByTestId('tablet-aside-tab-analysis');
    const panel = screen.getByTestId('tablet-aside-panel-analysis');
    const tabId = tab.getAttribute('id');
    const panelId = panel.getAttribute('id');
    expect(tabId).not.toBeNull();
    expect(panelId).not.toBeNull();
    expect(tab.getAttribute('aria-controls')).toBe(panelId);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabId);
  });

  // PR14 收纳态 (Shenlun & Tablet Refinements Handoff §3) =====================

  it('PR14: defaultCollapsed=true renders 32px bar with data-label + role=button', () => {
    renderAsideWithPanels(
      [['analysis', <div key="a">解析内容</div>]],
      { defaultCollapsed: true, label: '解析 / 笔记 / AI' },
    );
    const aside = screen.getByTestId('tablet-aside');
    // 浮条态: role=button + data-label + aria-label 含 "展开" + is-collapsed class
    expect(aside).toHaveAttribute('role', 'button');
    expect(aside).toHaveAttribute('data-label', '解析 / 笔记 / AI');
    expect(aside).toHaveAttribute('aria-label', '展开 解析 / 笔记 / AI');
    expect(aside.className).toContain('is-collapsed');
    // 浮条态不渲染 tab / panel 内容
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('tablet-aside-tab-analysis')).toBeNull();
  });

  it('PR14: collapsed bar click expands to full 320 three-tab panel', async () => {
    const user = userEvent.setup();
    renderAsideWithPanels(
      [['analysis', <div key="a">A panel</div>]],
      { defaultCollapsed: true, label: '解析 / 笔记 / AI' },
    );
    // 初始浮条态
    const bar = screen.getByTestId('tablet-aside');
    expect(bar.className).toContain('is-collapsed');

    // click 浮条展开
    await user.click(bar);

    // 展开态: aside 不再 is-collapsed, tablist 出现, default tab 选 analysis
    const expanded = screen.getByTestId('tablet-aside');
    expect(expanded.className).not.toContain('is-collapsed');
    expect(expanded).toHaveAttribute('aria-label', '解析 / 笔记 / AI');
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByTestId('tablet-aside-tab-analysis')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('tablet-aside-panel-analysis')).toHaveTextContent(
      'A panel',
    );
  });

  it('PR14: expanded mode collapse button click returns to 32px bar', async () => {
    const user = userEvent.setup();
    renderAsideWithPanels(
      [['analysis', <div key="a">A panel</div>]],
      { defaultCollapsed: false, label: '解析 / 笔记 / AI' },
    );
    // 初始展开态
    expect(screen.getByTestId('tablet-aside').className).not.toContain(
      'is-collapsed',
    );
    const collapseBtn = screen.getByTestId('tablet-aside-collapse');
    expect(collapseBtn).toHaveAttribute('aria-label', '收起面板');

    // click 收起按钮
    await user.click(collapseBtn);

    // 收回浮条态
    const bar = screen.getByTestId('tablet-aside');
    expect(bar.className).toContain('is-collapsed');
    expect(bar).toHaveAttribute('role', 'button');
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});
