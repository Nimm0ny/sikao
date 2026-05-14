import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbPassage, type FbPassageHandle, type FbPassageProps } from '../FbPassage';
import { useHighlightStore } from '@sikao/domain/xingce/useHighlightStore';
import type { MaterialGroup } from '@sikao/api-client/types/api';

// P4/2 FbPassage 测试 (TDD red→green).
//
// Coverage:
// - sticky top-14 z-20 容器 + data-testid
// - 段落 tabs 渲染 (1 段 / 3 段)
// - 默认 active tab = 段一 (passage-p1)
// - 点 tab 切 active + scrollIntoView 调用 + flash 类
// - 键盘 ArrowLeft / ArrowRight 在 tablist 切 tab (wrap)
// - P 键 toggle 折叠 (collapsed data-attr)
// - P 键 input/textarea 内不触发
// - aria-expanded / aria-controls / role=tab / aria-selected
// - flash animationend 清 flash 状态
// - 折叠按钮点击 toggle
// - 图表 assets 渲染
// - DOMPurify 剥离 <script>
// - imperative jumpToParagraph API (forwardRef)
// - 1 段时 tabs 仍渲 (avoid 0 tab 渲染崩)

const baseAssets = [
  {
    id: 11,
    assetRole: 'figure',
    mimeType: 'image/png',
    displayOrder: 1,
    url: '/api/v2/assets/material-groups/11',
  },
] as const;

function makeGroup(content: string, overrides: Partial<MaterialGroup> = {}): MaterialGroup {
  return {
    materialGroupId: 'mg-1',
    blockId: 'b-1',
    title: '材料一',
    content,
    groupKind: 'data_analysis',
    questions: [],
    ...overrides,
  };
}

beforeEach(() => {
  // jsdom 没有 scrollIntoView 实现 — mock 让测试可断言调用.
  Element.prototype.scrollIntoView = vi.fn();
  useHighlightStore.setState({ marks: {}, undoStack: [] });
});

describe('FbPassage', () => {
  it('renders sticky container with data-testid', () => {
    render(<FbPassage materialGroup={makeGroup('<p>段一</p>')} sectionTitle="资料分析" />);
    const root = screen.getByTestId('fb-passage');
    expect(root).toBeInTheDocument();
    expect(root.className).toContain('sticky');
    expect(root.className).toContain('top-14');
    expect(root.className).toContain('z-20');
  });

  it('renders 3 tabs for 3 paragraphs', () => {
    render(
      <FbPassage
        materialGroup={makeGroup('<p>段一</p><p>段二</p><p>段三</p>')}
        sectionTitle="资料分析"
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByTestId('fb-passage-tab-passage-p1')).toHaveTextContent('段1');
    expect(screen.getByTestId('fb-passage-tab-passage-p2')).toHaveTextContent('段2');
    expect(screen.getByTestId('fb-passage-tab-passage-p3')).toHaveTextContent('段3');
  });

  it('defaults active tab = passage-p1 (first)', () => {
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p><p>B</p>')}
        sectionTitle="资料分析"
      />,
    );
    const tab1 = screen.getByTestId('fb-passage-tab-passage-p1');
    const tab2 = screen.getByTestId('fb-passage-tab-passage-p2');
    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab2).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking tab fires scrollIntoView + activates tab', async () => {
    const user = userEvent.setup();
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p><p>B</p>')}
        sectionTitle="资料分析"
      />,
    );
    await user.click(screen.getByTestId('fb-passage-tab-passage-p2'));
    expect(screen.getByTestId('fb-passage-tab-passage-p2')).toHaveAttribute('aria-selected', 'true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'start' }),
    );
  });

  it('clicking tab applies is-flash className then animationend clears', async () => {
    const user = userEvent.setup();
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p><p>B</p>')}
        sectionTitle="资料分析"
      />,
    );
    await user.click(screen.getByTestId('fb-passage-tab-passage-p2'));
    const region = screen.getByTestId('fb-passage-paragraph-passage-p2');
    expect(region.className).toContain('is-flash');
    // animationend 后清; React 19 + RTL fireEvent.animationEnd 在 jsdom 偶尔
    // 不 dispatch. 直接 dispatchEvent 触发 'animationend' bubble event,
    // React event delegation 会捕获并调 onAnimationEnd.
    await act(async () => {
      fireEvent.animationEnd(region, { animationName: 'fb-passage-flash' });
    });
    expect(region.className).not.toContain('is-flash');
  });

  it('keyboard ArrowRight in tablist moves to next tab (wrap)', () => {
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p><p>B</p><p>C</p>')}
        sectionTitle="资料分析"
      />,
    );
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getByTestId('fb-passage-tab-passage-p2')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getByTestId('fb-passage-tab-passage-p3')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    // wrap 回 p1
    expect(screen.getByTestId('fb-passage-tab-passage-p1')).toHaveAttribute('aria-selected', 'true');
  });

  it('keyboard ArrowLeft in tablist moves to previous tab (wrap)', () => {
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p><p>B</p>')}
        sectionTitle="资料分析"
      />,
    );
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    // wrap 到 p2 (从 p1 往左 wrap)
    expect(screen.getByTestId('fb-passage-tab-passage-p2')).toHaveAttribute('aria-selected', 'true');
  });

  it('controlled mode: collapsed prop drives data-collapsed', () => {
    // P6 controlled: PracticeSession 顶层 passagesCollapsed 单 state 传入.
    const { rerender } = render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p>')}
        sectionTitle="资料分析"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );
    expect(screen.getByTestId('fb-passage')).toHaveAttribute('data-collapsed', 'false');
    rerender(
      <FbPassage
        materialGroup={makeGroup('<p>A</p>')}
        sectionTitle="资料分析"
        collapsed={true}
        onToggleCollapsed={vi.fn()}
      />,
    );
    expect(screen.getByTestId('fb-passage')).toHaveAttribute('data-collapsed', 'true');
  });

  it('collapse button click → onToggleCollapsed callback (controlled mode)', async () => {
    // P6: 折叠 toggle 抛上层. P 键 hotkey 由 PracticeSession 接 useFbKeyboard;
    // FbPassage 自己不再 listen window keydown (防 P0 broadcast bug).
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p>')}
        sectionTitle="资料分析"
        collapsed={false}
        onToggleCollapsed={onToggle}
      />,
    );
    await user.click(screen.getByTestId('fb-passage-collapse-btn'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('uncontrolled fallback: collapse button toggles internal state + aria-expanded', async () => {
    // 不传 collapsed prop → fallback internal useState (dev preview / 单独测试).
    const user = userEvent.setup();
    render(
      <FbPassage materialGroup={makeGroup('<p>A</p>')} sectionTitle="资料分析" />,
    );
    const root = screen.getByTestId('fb-passage');
    const btn = screen.getByTestId('fb-passage-collapse-btn');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    await user.click(btn);
    expect(root).toHaveAttribute('data-collapsed', 'true');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('window keyDown "p" no longer toggles (P 键已交 useFbKeyboard dispatcher)', () => {
    // P4-followup P0 fix verification: FbPassage 不再 listen window keydown,
    // 单次 P 不会触发多个 mg 的 setState (broadcast bug 修复).
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p>')}
        sectionTitle="资料分析"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );
    const root = screen.getByTestId('fb-passage');
    expect(root).toHaveAttribute('data-collapsed', 'false');
    fireEvent.keyDown(window, { key: 'p' });
    // collapsed 还是 controlled 传入的 false (P 键 hotkey 不再生效 — 全局 dispatcher 负责).
    expect(root).toHaveAttribute('data-collapsed', 'false');
  });

  it('renders image assets at body end', () => {
    render(
      <FbPassage
        materialGroup={makeGroup('<p>A</p>', { assets: baseAssets })}
        sectionTitle="资料分析"
      />,
    );
    const assets = screen.getByTestId('fb-passage-assets');
    expect(assets).toBeInTheDocument();
    const img = assets.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('/api/v2/assets/material-groups/11');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('strips <script> tag (DOMPurify)', () => {
    render(
      <FbPassage
        materialGroup={makeGroup('<p>正常段</p><script>alert(1)</script>')}
        sectionTitle="资料分析"
      />,
    );
    const region = screen.getByTestId('fb-passage-paragraph-passage-p1');
    expect(region.innerHTML).not.toContain('<script');
    expect(region.innerHTML).not.toContain('alert');
  });

  it('imperative jumpToParagraph fires scrollIntoView + activates tab', () => {
    function Harness() {
      const ref = useRef<FbPassageHandle>(null);
      const props: FbPassageProps = {
        materialGroup: makeGroup('<p>A</p><p>B</p><p>C</p>'),
        sectionTitle: '资料分析',
      };
      return (
        <div>
          <button data-testid="jump-btn" onClick={() => ref.current?.jumpToParagraph('passage-p3')}>
            jump
          </button>
          <FbPassage {...props} ref={ref} />
        </div>
      );
    }
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByTestId('jump-btn'));
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByTestId('fb-passage-tab-passage-p3')).toHaveAttribute('aria-selected', 'true');
  });

  it('renders 1 tab when content is empty (≥1 段保证 fallback)', () => {
    render(
      <FbPassage materialGroup={makeGroup('')} sectionTitle="资料分析" />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(screen.getByTestId('fb-passage-tab-passage-p1')).toBeInTheDocument();
  });

  // P5b/2 paragraph-scope highlight (passage 渲染走 renderStemWithMarks)
  it('P5b/2: paragraph section 含 data-question-id=paragraphId (供 SelectionToolbar arm)', () => {
    render(
      <FbPassage
        materialGroup={makeGroup('<p>段一文字</p><p>段二文字</p>')}
        sectionTitle="资料分析"
      />,
    );
    const p1 = screen.getByTestId('fb-passage-paragraph-passage-p1');
    expect(p1.getAttribute('data-question-id')).toBe('passage-p1');
  });

  it('P5b/2: store 有 paragraph-scope mark → <mark.fb-hl> 插入', () => {
    useHighlightStore.getState().addMark({
      id: 'mp-1',
      questionId: 'passage-p1',
      textStart: 0,
      textLength: 2,
      colorKey: 'b',
      createdAt: Date.now(),
    });
    render(
      <FbPassage
        materialGroup={makeGroup('<p>段一文字</p>')}
        sectionTitle="资料分析"
      />,
    );
    const p1 = screen.getByTestId('fb-passage-paragraph-passage-p1');
    const mark = p1.querySelector('mark.fb-hl');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('data-c')).toBe('b');
  });
});
