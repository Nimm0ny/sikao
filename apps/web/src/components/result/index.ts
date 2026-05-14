// Phase 3.3 result barrel — same pattern as components/practice/index.ts
// and components/home/index.ts: pure .ts re-exports so react-refresh stays
// quiet and page-level code never reaches into individual files.

export { ScoreHero } from './ScoreHero';
export type { ScoreHeroProps } from './ScoreHero';

export { ScoreHeader } from './ScoreHeader';
export type { ScoreHeaderProps } from './ScoreHeader';

// SIKAO Wave 2 Phase 2 — hifi 05 paper-tint ResultHero / SubjectCatTable / ResultAside
export { ResultHero } from './ResultHero';
export type { ResultHeroProps } from './ResultHero';

export { SubjectCatTable } from './SubjectCatTable';
export type { SubjectCatTableProps } from './SubjectCatTable';

export { ResultAside } from './ResultAside';
export type { ResultAsideProps } from './ResultAside';

// SIKAO Wave 2 Phase 3 — hifi 05b 申论结果 primitive (Fixer D)
export { EssayResultHero } from './EssayResultHero';
export type { EssayResultHeroProps } from './EssayResultHero';

// SIKAO Wave 4 — EssayExamResults pending hero block.
export { EssayExamHeroPending } from './EssayExamHeroPending';
export type { EssayExamHeroPendingProps } from './EssayExamHeroPending';

// SIKAO Wave 4 — EssayExamResults aside sidebar.
export { EssayExamSidebar } from './EssayExamSidebar';
export type { EssayExamSidebarProps } from './EssayExamSidebar';

export { QuestionBreakdown } from './QuestionBreakdown';
export type { QuestionBreakdownProps } from './QuestionBreakdown';

export { EssayThinkBlock } from './EssayThinkBlock';
export type { EssayThinkBlockProps } from './EssayThinkBlock';

export {
  EssayResultAside,
  StatRow,
  RefList,
  RefListItem,
} from './EssayResultAside';
export type {
  EssayResultAsideProps,
  AsideCardSection,
  StatRowProps,
  RefListProps,
  RefListItemProps,
} from './EssayResultAside';

export type {
  RubricItem,
  RubricTone,
  QuestionBreakdownItem,
} from './_essayResultHelpers';

export {
  classifyRubricTone,
  computeBarWidth,
  isWeakQuestion,
  splitTextWithHighlights,
  ESSAY_WEAK_THRESHOLD,
} from './_essayResultHelpers';

// SIKAO Wave 4 — view-level helpers (EssayExamResults + EssayGradingResult).
export {
  pickResultHeadline,
  buildExamSubtitle,
  buildExamItem,
  formatRecordSummary,
  buildGradingLbl,
  buildGradingSubtitle,
  buildSingleRecordItem,
  pickThinkTitle,
  buildThinkParagraphs,
  formatGradingDelay,
  buildExamOverviewRows,
  buildExamStatusRows,
  buildGradingOverviewRows,
  buildGradingDimensionRows,
  buildExamEyebrow,
  buildExamLbl,
} from './_essayResultViewHelpers';
export type {
  ExamAsideRowConfig,
  ExamAsideStatusRow,
  GradingOverviewRow,
  GradingDimensionRow,
} from './_essayResultViewHelpers';

export { ScoreModuleCard } from './ScoreModuleCard';
export type { ScoreModuleCardProps } from './ScoreModuleCard';

export { SectionAccuracyCard } from './SectionAccuracyCard';
export type { SectionAccuracyCardProps } from './SectionAccuracyCard';

export { AnswerComparisonGrid } from './AnswerComparisonGrid';
export type {
  AnswerComparisonGridProps,
  AnswerComparisonCell,
  AnswerCellState,
} from './AnswerComparisonGrid';

export { AnswerCardPanel } from './AnswerCardPanel';
export type {
  AnswerCardPanelProps,
  AnswerCardCell,
  CellState,
} from './AnswerCardPanel';

export { WrongReviewCard } from './WrongReviewCard';
export type { WrongReviewCardProps } from './WrongReviewCard';

export { WrongReviewSection } from './WrongReviewSection';
export type { WrongReviewSectionProps, WrongReviewItem } from './WrongReviewSection';

export { ResultActions } from './ResultActions';
export type { ResultActionsProps } from './ResultActions';

export { ResultPageSkeleton } from './ResultPageSkeleton';

export { TimingTimeline } from './TimingTimeline';
export type {
  TimingTimelineProps,
  TimingTimelineSectionLabel,
} from './TimingTimeline';

export { TimingByModule } from './TimingByModule';
export type { TimingByModuleProps } from './TimingByModule';

export { SlowestQuestions } from './SlowestQuestions';
export type { SlowestQuestionsProps } from './SlowestQuestions';

export { KnowledgePointFocus } from './KnowledgePointFocus';
export type { KnowledgePointFocusProps } from './KnowledgePointFocus';

export { StrengthWeaknessCards } from './StrengthWeaknessCards';
export type { StrengthWeaknessCardsProps } from './StrengthWeaknessCards';

export { AiSuggestionCard } from './AiSuggestionCard';
export type { AiSuggestionCardProps } from './AiSuggestionCard';

export { ResultTabNav } from './ResultTabNav';
export type { ResultTabNavProps, ResultTabItem } from './ResultTabNav';
