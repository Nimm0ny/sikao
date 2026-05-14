import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { BottomSheet } from '@sikao/ui/ui/BottomSheet';
import {
  AiIcon,
  FileTextIcon,
  NoteIcon,
} from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import {
  useAsideOutlet,
  type AsideKey,
  type AsidePanels,
} from './useAsideOutlet';

/**
 * AsideBottomBar — 平板竖屏 (T4 portrait) 答题练习视图的底部 3 IconBtn
 * 切换栏 (解析 / 笔记 / AI), tap 弹 BottomSheet size=tall.
 *
 * 来源 SSOT:
 *   - docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §4.2-4.4
 *   - docs/plan/practice-center-mobile-tablet-redesign.md §4 PR15
 *
 * 替代旧设计的右浮条 (T1 横屏 36px), 解决竖屏跟题头 annotate-bar 横向冲突.
 *
 * 行为铁线:
 *   - **路由 gate**: 只在 /practice/sessions/* 或 /essay/exam/* 路径下渲染,
 *     其他 portrait view (Dashboard / Profile 等) 不挂底栏. AsideOutlet 也是空.
 *   - **panel 缺失**: caller 没 useAsideSet 注入对应 key → 按钮 disabled
 *     (AsideOutlet 返回 panels 不含 key). 不渲染空 sheet.
 *   - **a11y**: 每个 IconBtn aria-label 中文 + Tooltip primitive (非 native title).
 *   - **SVG-only**: 复用现有 icons/FileTextIcon (解析) / NoteIcon (笔记) /
 *     AiIcon (AI). 不创新 SVG (CLAUDE.md §4 答题按钮 SVG-only 铁线).
 *   - **CSS**: 走 `.t-aside-bottom` token-based (index.css §T-aside-bottom).
 *     paddingBottom 含 env(safe-area-inset-bottom) 给 iOS home indicator 让位.
 *
 * 跟 TabletShell portrait 集成: TabletShell render 自己始终挂 <AsideBottomBar />
 * 顶层判断, 路由 / panel 缺失内部 return null. 调用方零感知.
 */

interface BottomBarButtonSpec {
  readonly key: AsideKey;
  readonly label: string;
  readonly tooltip: string;
  readonly icon: ReturnType<typeof renderIcon>;
}

function renderIcon(kind: AsideKey) {
  if (kind === 'analysis') return <FileTextIcon size={20} />;
  if (kind === 'notes') return <NoteIcon size={20} />;
  return <AiIcon size={20} />;
}

const BUTTONS: readonly BottomBarButtonSpec[] = [
  { key: 'analysis', label: '解析', tooltip: '查看解析', icon: renderIcon('analysis') },
  { key: 'notes', label: '笔记', tooltip: '查看笔记', icon: renderIcon('notes') },
  { key: 'ask', label: '问 AI', tooltip: '问 AI', icon: renderIcon('ask') },
] as const;

// 答题闭环路由前缀 — 行测 session + 申论考场. AsideBottomBar 只在这些路径渲染.
// 跟 PracticeSession / EssayExamSikao 当前路由对齐 (router/index.tsx).
const PRACTICE_PATH_PREFIXES: readonly string[] = [
  '/practice/sessions/',
  '/essay/exam/',
  '/essay/specialty/',
] as const;

function isPracticeRoute(pathname: string): boolean {
  return PRACTICE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function resolveSheetTitle(openKey: AsideKey | null): string {
  if (openKey === 'analysis') return '解析';
  if (openKey === 'notes') return '笔记';
  if (openKey === 'ask') return '问 AI';
  return '面板';
}

interface AsideBottomBarPanelsState {
  readonly panels: AsidePanels;
  readonly openKey: AsideKey | null;
}

function renderPanelBody(state: AsideBottomBarPanelsState): React.ReactNode {
  const { panels, openKey } = state;
  if (openKey === null) return null;
  const node = panels[openKey];
  if (node != null) return node;
  // 兜底空态 — caller 没注入对应 key (e.g. AI panel 未上线).
  // 不抛错, 保留 sheet UI 让用户看到 placeholder 文案. Fail-Fast 仅适用于
  // 业务流程错误; UI 空槽是合法 state (PR10 / Wave 后续 wave 才填).
  return (
    <p
      data-testid="aside-bottom-bar-empty"
      className="font-serif text-base text-ink-3 py-12 text-center"
    >
      {resolveSheetTitle(openKey)} 面板即将上线
    </p>
  );
}

export function AsideBottomBar() {
  const { pathname } = useLocation();
  const panels = useAsideOutlet();
  const [openKey, setOpenKey] = useState<AsideKey | null>(null);

  // 路由 gate: 只在答题闭环路径下渲染. 其他 portrait view 0 显示.
  if (!isPracticeRoute(pathname)) return null;

  // panel 全空 (caller 未注入) — 不渲染底栏避免视觉占位空荡.
  // 实际答题路径 useAsideSet 会注入至少 analysis + notes 两个.
  if (panels === null || Object.keys(panels).length === 0) return null;

  const resolvedPanels: AsidePanels = panels;
  const handleClose = () => setOpenKey(null);
  const sheetTitle = resolveSheetTitle(openKey);

  return (
    <>
      <nav
        className={cn('t-aside-bottom')}
        aria-label="解析 / 笔记 / AI"
        data-testid="aside-bottom-bar"
        role="toolbar"
      >
        {BUTTONS.map((btn) => {
          const enabled = resolvedPanels[btn.key] != null;
          const isActive = openKey === btn.key;
          return (
            <Tooltip key={btn.key} label={btn.tooltip}>
              <IconBtn
                size="md"
                variant={isActive ? 'on' : 'default'}
                aria-label={btn.label}
                aria-pressed={isActive}
                disabled={!enabled}
                onClick={() => setOpenKey(btn.key)}
                data-testid={`aside-bottom-bar-${btn.key}`}
              >
                {btn.icon}
              </IconBtn>
            </Tooltip>
          );
        })}
      </nav>
      <BottomSheet
        open={openKey !== null}
        onClose={handleClose}
        size="tall"
        title={sheetTitle}
      >
        {renderPanelBody({ panels: resolvedPanels, openKey })}
      </BottomSheet>
    </>
  );
}
