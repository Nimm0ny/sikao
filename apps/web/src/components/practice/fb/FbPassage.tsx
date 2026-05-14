import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronDownIcon } from '@sikao/ui/icons';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { MaterialGroup, MaterialGroupAssetV2 } from '@sikao/api-client/types/api';
import { splitPassageParagraphs, type PassageParagraph } from './lib/splitPassageParagraphs';
import { renderStemWithMarks } from './lib/renderStemWithMarks';
import { useHighlightStore, type Mark } from '@sikao/domain/xingce/useHighlightStore';
import './fb-passage.css';

// Stable empty marks ref — 同 FbCard EMPTY_MARKS 原因 (避 store rerender 死循环).
const EMPTY_PASSAGE_MARKS: readonly Mark[] = Object.freeze([]);

// P4/2 资料分析 sticky 材料 + 段落 tab + 锚跳 + 1.2s 闪烁
// (SIKAO 答题系统行测).
//
// 设计 SSOT: SPEC §4.3 + §10 / design/SIKAO/xingce-redesign/option-B-paper-quiet.html.
//
// 行为:
//   - sticky top-14 (FbTopbar top-0 z-30 56px 高 → passage top 56px) z-20
//   - tablist + role=tab + aria-selected + aria-controls + ArrowLeft/Right
//   - 点 tab / 外部 jumpToParagraph 触发 scrollIntoView({behavior:'smooth'})
//     + 1.2s 黄色闪烁 (用 @keyframes fb-passage-flash + animationend 监听)
//   - 折叠态 height: 24px overflow: hidden (不用 display:none 保 sticky)
//   - assets (图表) 渲染在 passage body 末尾, 折叠跟着隐藏
//
// P6 (2026-05-11): P 键全局 dispatcher 接管 (useFbKeyboard); FbPassage 改
// controlled state — `collapsed` + `onToggleCollapsed` 由 PracticeSession 顶层
// 维护单 state passagesCollapsed (全部 toggle, SPEC §10 明文 "折叠资料分析材料"
// 是单一动作). props 缺失时 fallback internal state (单独测试 / dev preview 用).
// 修复 P4-followup P0 broadcast bug: 之前 4 个 FbPassage 各自 window listener
// 单次 P 触发 4 个 setState.
//
// 暴露 imperative API (forwardRef + useImperativeHandle):
//   - jumpToParagraph(id): scrollIntoView + flash + activate tab + 强制展开
// FbReadingCol 锚跳子题 ⤴ 段一/二/三 通过 ref 调.
//
// Dumb by contract: 不读 store / 路由 / 后端. 数据全 props.

export interface FbPassageHandle {
  /**
   * 锚跳到指定 paragraph: scrollIntoView({smooth}) + 闪烁 + 切 active tab.
   * 若 paragraph id 不存在, no-op.
   */
  jumpToParagraph: (paragraphId: string) => void;
}

export interface FbPassageProps {
  readonly materialGroup: MaterialGroup;
  readonly sectionTitle: string;
  /**
   * P6 controlled: 折叠态来自上层 (PracticeSession 维护 passagesCollapsed 单 state).
   * 未提供时 fallback internal state (dev preview / 单独测试).
   */
  readonly collapsed?: boolean;
  /**
   * P6 controlled: 折叠按钮 onClick 抛上层. 上层 toggle passagesCollapsed.
   * 未提供时 fallback internal toggle.
   */
  readonly onToggleCollapsed?: () => void;
  /**
   * P6 imperative: jumpToParagraph 内部强制展开 (折叠时 scrollIntoView 看不到).
   * controlled 模式下抛上层 set passagesCollapsed=false; uncontrolled 模式
   * fallback 内部 setCollapsed(false).
   */
  readonly onForceExpand?: () => void;
}

export const FbPassage = forwardRef<FbPassageHandle, FbPassageProps>(
  function FbPassage(
    { materialGroup, sectionTitle, collapsed: collapsedProp, onToggleCollapsed, onForceExpand },
    ref,
  ) {
    const paragraphs = useMemo(
      () => splitPassageParagraphs(materialGroup.content ?? ''),
      [materialGroup.content],
    );

    // controlled 模式: collapsed prop 提供 → 用它; toggle 抛上层.
    // uncontrolled fallback: 内部 useState (dev preview / 单独测试).
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const collapsed = collapsedProp ?? internalCollapsed;
    const toggleCollapsed = useCallback(() => {
      if (onToggleCollapsed !== undefined) {
        onToggleCollapsed();
        return;
      }
      setInternalCollapsed((c) => !c);
    }, [onToggleCollapsed]);

    const [activeTabId, setActiveTabId] = useState<string>(
      () => paragraphs[0]?.id ?? 'passage-p1',
    );
    const [flashId, setFlashId] = useState<string | null>(null);

    const paragraphRefs = useRef(new Map<string, HTMLElement | null>());
    const tablistRef = useRef<HTMLDivElement | null>(null);

    const registerParagraphRef = useCallback(
      (id: string) => (node: HTMLElement | null) => {
        paragraphRefs.current.set(id, node);
      },
      [],
    );

    // 锚跳 imperative: 切 tab + scrollIntoView + flash. 折叠时先强制展开.
    const jumpToParagraph = useCallback(
      (id: string) => {
        const node = paragraphRefs.current.get(id);
        if (node === null || node === undefined) return;
        setActiveTabId(id);
        // 折叠时先展开, 否则 scroll 不到 (height:24px overflow:hidden 看不到).
        if (onForceExpand !== undefined) {
          onForceExpand();
        } else {
          setInternalCollapsed(false);
        }
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setFlashId(id);
      },
      [onForceExpand],
    );

    useImperativeHandle(ref, () => ({ jumpToParagraph }), [jumpToParagraph]);

    // 键盘 ArrowLeft/Right 切 tab. activeTabId 当前 index, wrap.
    const handleTablistKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (paragraphs.length === 0) return;
        const idx = paragraphs.findIndex((p) => p.id === activeTabId);
        if (idx < 0) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = paragraphs[(idx - 1 + paragraphs.length) % paragraphs.length];
          setActiveTabId(next.id);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = paragraphs[(idx + 1) % paragraphs.length];
          setActiveTabId(next.id);
        }
      },
      [paragraphs, activeTabId],
    );

    const handleTabClick = useCallback(
      (id: string) => {
        jumpToParagraph(id);
      },
      [jumpToParagraph],
    );

    const handleFlashEnd = useCallback((id: string) => {
      setFlashId((current) => (current === id ? null : current));
    }, []);

    const collapsedAttr = collapsed ? 'true' : 'false';
    const bodyId = `fb-passage-body-${materialGroup.materialGroupId}`;

    return (
      <aside
        className="fb-passage sticky top-14 z-20 bg-surface border-b border-line"
        data-testid="fb-passage"
        data-collapsed={collapsedAttr}
        aria-labelledby={`fb-passage-title-${materialGroup.materialGroupId}`}
      >
        {/* Header: 标题 + 段落 tabs + 折叠按钮 */}
        <div className="flex items-center gap-4 px-6 py-2 border-b border-line">
          <h3
            id={`fb-passage-title-${materialGroup.materialGroupId}`}
            className="font-serif text-sm text-ink shrink-0"
          >
            {materialGroup.title || sectionTitle}
          </h3>
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="材料段落"
            className="flex items-center gap-2 grow overflow-x-auto"
            onKeyDown={handleTablistKeyDown}
          >
            {paragraphs.map((p, idx) => {
              const isActive = activeTabId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={p.id}
                  id={`passage-tab-${p.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabClick(p.id)}
                  className={cn(
                    'shrink-0 font-mono text-tiny tracking-eyebrow px-2 py-1 rounded-tiny transition-colors',
                    isActive
                      ? 'bg-ink text-surface'
                      : 'bg-transparent text-ink-3 hover:bg-paper-2',
                  )}
                  data-testid={`fb-passage-tab-${p.id}`}
                >
                  {`段${idx + 1}`}
                </button>
              );
            })}
          </div>
          <Tooltip label={collapsed ? '展开材料 (P)' : '折叠材料 (P)'} side="left">
            <IconBtn
              size="sm"
              aria-label={collapsed ? '展开材料' : '折叠材料'}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              onClick={toggleCollapsed}
              data-testid="fb-passage-collapse-btn"
            >
              <ChevronDownIcon
                size={16}
                className={cn(
                  'transition-transform',
                  collapsed ? '-rotate-90' : 'rotate-0',
                )}
              />
            </IconBtn>
          </Tooltip>
        </div>

        {/* Body: paragraphs + assets */}
        <div
          id={bodyId}
          className="fb-passage-body px-6 py-4 max-h-[40vh] overflow-y-auto"
        >
          {paragraphs.map((p) => (
            <PassageParagraphNode
              key={p.id}
              paragraph={p}
              isFlash={flashId === p.id}
              registerRef={registerParagraphRef(p.id)}
              onFlashEnd={() => handleFlashEnd(p.id)}
            />
          ))}
          <PassageAssets assets={materialGroup.assets ?? []} />
        </div>
      </aside>
    );
  },
);

interface PassageParagraphNodeProps {
  readonly paragraph: PassageParagraph;
  readonly isFlash: boolean;
  readonly registerRef: (node: HTMLElement | null) => void;
  readonly onFlashEnd: () => void;
}

function PassageParagraphNode({
  paragraph,
  isFlash,
  registerRef,
  onFlashEnd,
}: PassageParagraphNodeProps) {
  // P5b/2: 渲染从 dangerouslySetInnerHTML 切到 renderStemWithMarks
  // (复用 stem 渲染算法, 保 sanitize chain + 后续 paragraph-scope highlight 兼容).
  // 当前 paragraph-scope marks 走 store key = paragraph.id (passage 不属 question;
  // P5b 主路径是 stem 划线, paragraph 可后续 P5b/+1 接).
  const paragraphMarks = useHighlightStore(
    (s) => s.marks[paragraph.id] ?? EMPTY_PASSAGE_MARKS,
  );
  const stemNodes = useMemo(
    () => renderStemWithMarks(paragraph.html, paragraphMarks),
    [paragraph.html, paragraphMarks],
  );
  // 使用 native addEventListener 监听 animationend, 避免 React 19 event
  // delegation 在 jsdom 测试环境不 fire 的兼容性问题 (verified 2026-05-11).
  // 真实浏览器走 native 'animationend', 跟 fb-passage-flash @keyframes 配合.
  const localRef = useRef<HTMLElement | null>(null);
  const onFlashEndRef = useRef(onFlashEnd);
  useEffect(() => {
    onFlashEndRef.current = onFlashEnd;
  }, [onFlashEnd]);
  useEffect(() => {
    const node = localRef.current;
    if (node === null) return;
    const handler = () => {
      onFlashEndRef.current();
    };
    node.addEventListener('animationend', handler);
    return () => node.removeEventListener('animationend', handler);
  }, []);
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      localRef.current = node;
      registerRef(node);
    },
    [registerRef],
  );
  return (
    <section
      ref={setRefs}
      id={paragraph.id}
      data-question-id={paragraph.id}
      role="region"
      aria-labelledby={`passage-tab-${paragraph.id}`}
      className={cn(
        'fb-passage-paragraph py-2 text-sm text-ink-3 leading-relaxed',
        isFlash && 'is-flash',
      )}
      style={{ scrollMarginTop: '56px' }}
      data-testid={`fb-passage-paragraph-${paragraph.id}`}
    >
      {stemNodes}
    </section>
  );
}

interface PassageAssetsProps {
  readonly assets: readonly MaterialGroupAssetV2[];
}

function PassageAssets({ assets }: PassageAssetsProps) {
  const imageAssets = assets.filter((a) => a.mimeType.startsWith('image/'));
  if (imageAssets.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="fb-passage-assets">
      {imageAssets.map((asset) => (
        <img
          key={asset.id}
          src={asset.url}
          alt={asset.assetRole || '材料图'}
          loading="lazy"
          className="max-w-full h-auto rounded-card border border-line bg-surface"
        />
      ))}
    </div>
  );
}
