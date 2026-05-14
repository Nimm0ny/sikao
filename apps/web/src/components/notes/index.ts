/**
 * SIKAO Wave 4 Phase 2D · notes/ barrel.
 *
 * 6 核心 (Phase 2D ship) + Wave 6E 集成入口 (跨模块"添加到笔记"). 推 Phase 5+:
 * NoteDrawer / TagCloud / SourceFilter 独立组件 / 双向链接.
 */
export { NoteCard } from './NoteCard';
export type { NoteCardProps } from './NoteCard';
export { TypeTabs } from './TypeTabs';
export type { TypeTabsProps, TypeTabValue } from './TypeTabs';
export { SprintCard } from './SprintCard';
export type { SprintCardProps } from './SprintCard';
export { ReviewStack } from './ReviewStack';
export type { ReviewStackProps } from './ReviewStack';
export { CaptureBar } from './CaptureBar';
export type { CaptureBarProps, CaptureInput } from './CaptureBar';
export { NotesToolbar } from './NotesToolbar';
export type { NotesToolbarProps, SortMode } from './NotesToolbar';

// Wave 6E (2026-05-12 lhr 自治): 跨模块"添加到笔记"入口 — xingce/essay/wrong-book.
export { NoteCaptureModal } from './NoteCaptureModal';
export type {
  NoteCaptureModalProps,
  NoteAttachTarget,
  NoteAttachTargetKind,
} from './NoteCaptureModal';
export { NoteCaptureLauncher } from './NoteCaptureLauncher';
export type { NoteCaptureLauncherProps } from './NoteCaptureLauncher';

// Wave 10 Phase C (2026-05-12): 社区笔记 — 题目下方"同学的笔记".
// Phase D (2026-05-12): mock → real useQuery 切换, 类型 SSOT 改走 @/hooks/useCommunityNotes
// (re-export api.generated.ts components['schemas']['*']).
export { CommunityNotesSection } from './CommunityNotesSection';
export type { CommunityNotesSectionProps } from './CommunityNotesSection';
export { CommunityNoteCard } from './CommunityNoteCard';
export type { CommunityNoteCardProps } from './CommunityNoteCard';
export { NoteCommentsList } from './NoteCommentsList';
export type { NoteCommentsListProps } from './NoteCommentsList';
export type {
  CommunityNote,
  CommunityNoteComment,
  CommunityNoteCommentList,
  CommunityNoteListResponse,
} from '@sikao/domain/notes/useCommunityNotes';
