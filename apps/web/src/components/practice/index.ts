// Phase 3.2 practice barrel — same rationale as components/ui/index.ts:
// pure .ts file so react-refresh/only-export-components stays quiet, and
// page-level code never reaches into individual component files.

export { AnswerCardGrid } from './AnswerCardGrid';
export type { AnswerCardGridProps, AnswerCardSection } from './AnswerCardGrid';

export { PracticeTimer } from './PracticeTimer';
export type { PracticeTimerProps, PracticeTimerMode } from './PracticeTimer';

export { AnswerCardDrawerHeader } from './AnswerCardDrawerHeader';
export type { AnswerCardDrawerHeaderProps } from './AnswerCardDrawerHeader';

export { AnswerCardPanel } from './AnswerCardPanel';
export type { AnswerCardPanelProps } from './AnswerCardPanel';

export { AnswerCardStickyTab } from './AnswerCardStickyTab';
export type { AnswerCardStickyTabProps } from './AnswerCardStickyTab';

export { ExitConfirmModal } from './ExitConfirmModal';
export type { ExitConfirmModalProps } from './ExitConfirmModal';

export { DrawerFooter } from './DrawerFooter';
export type { DrawerFooterProps } from './DrawerFooter';

export { SessionFooter } from './SessionFooter';
export type { SessionFooterProps } from './SessionFooter';

export { SessionHeader } from './SessionHeader';
export type { SessionHeaderProps, SessionHeaderTimer } from './SessionHeader';

export { ViewModeToggle } from './ViewModeToggle';
export type { ViewModeToggleProps, PracticeViewMode } from './ViewModeToggle';

export { SessionLoading } from './SessionLoading';
