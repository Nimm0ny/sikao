// SIKAO Phase 3 (2026-05-09): fb 行测核心答题组件 barrel.
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md.
//
// .ts (无 JSX) — react-refresh/only-export-components 配合, page-level 不
// reach into 单文件.

export { FbActions } from './FbActions';
export type { FbActionsProps } from './FbActions';

export { FbCard } from './FbCard';
export type { FbCardProps } from './FbCard';

export { FbChapterLabel } from './FbChapterLabel';
export type { FbChapterLabelProps } from './FbChapterLabel';

// Wave 4 Phase 2A (2026-05-12): FbDock → FbDrawer 改名.
// 保留 FbDock / FbDockGrid / FbDockSubmitFooter alias 防其他文件 breaking;
// 新代码请用 FbDrawer / FbDrawerGrid / FbDrawerSubmitFooter.
export {
  FbDrawer,
  FbDrawer as FbDock,
  FbDrawerGrid,
  FbDrawerGrid as FbDockGrid,
  FbDrawerSubmitFooter,
  FbDrawerSubmitFooter as FbDockSubmitFooter,
} from './FbDrawer';
export type {
  FbDrawerProps,
  FbDrawerProps as FbDockProps,
  FbDrawerGridProps,
  FbDrawerGridProps as FbDockGridProps,
  FbDrawerSubmitFooterProps,
  FbDrawerSubmitFooterProps as FbDockSubmitFooterProps,
} from './FbDrawer';

export { FbDockBody } from './FbDockBody';
export type { FbDockBodyProps } from './FbDockBody';

export { FbBottomDock } from './FbBottomDock';
export type { FbBottomDockProps } from './FbBottomDock';

export { FbLayout } from './FbLayout';
export type { FbLayoutProps } from './FbLayout';

export { FbMobileScratchSheet } from './FbMobileScratchSheet';
export type { FbMobileScratchSheetProps } from './FbMobileScratchSheet';

export { FbOpts } from './FbOpts';
export type { FbOptsProps } from './FbOpts';

export { FbPassage } from './FbPassage';
export type { FbPassageHandle, FbPassageProps } from './FbPassage';

export { FbReadingCol } from './FbReadingCol';
export type { FbReadingColProps } from './FbReadingCol';

export { FbScratchClip } from './FbScratchClip';
export type { FbScratchClipProps } from './FbScratchClip';

export { FbScratchCol } from './FbScratchCol';
export type { FbScratchColProps } from './FbScratchCol';

export { FbScratchFab } from './FbScratchFab';
export type { FbScratchFabProps } from './FbScratchFab';

export { FbTF } from './FbTF';
export type { FbTFProps } from './FbTF';

export { FbTopbar } from './FbTopbar';
export type { FbTopbarProps } from './FbTopbar';

export { useFbUiState, useElapsedSeconds, useFbCurrentVisibleObserver } from './useFbSession';
export type {
  FbUiState,
  FlatQuestion,
  UseFbCurrentVisibleObserverArgs,
} from './useFbSession';

export { useFbKeyboard } from './useFbKeyboard';
export type { UseFbKeyboardArgs } from './useFbKeyboard';

export { useFbMobileSwipe } from './useFbMobileSwipe';
export type { FbMobileSwipeHandlers, UseFbMobileSwipeArgs } from './useFbMobileSwipe';

export {
  buildSectionGroups,
  buildSectionItems,
  listSectionQuestions,
  totalQuestionCount,
} from './sectionGroups';
export type { SectionGroup, SectionGroupItem, SectionItemsGroup } from './sectionGroups';
