// SIKAO icon barrel — named re-exports only (tree-shake friendly).
//
// SSOT: design/SIKAO/icon-spec/SVG-ICON-DESIGN-SYSTEM.md §9.
// 不用 `export *` (会绕过 tree-shake), 不写 default export.
//
// 历史 19 个 icon (XCloseIcon / SettingsIcon / etc.) 与新 spec 命名 (NavCloseIcon
// / ToolSettingsIcon / etc.) 共存; 两组都从这里出. 旧 icon 还在 view 内被引用,
// 等后续 sweep 把旧 icon 一起替换到 spec 命名时再删.

// ── Shared types ───────────────────────────────────────────────────────────
export type { IconProps } from './types';

// ── Legacy icons (Phase 1' 已存在, 保留 import 兼容) ────────────────────────
export { AiIcon } from './AiIcon';
export { AnswerCardIcon } from './AnswerCardIcon';
export { ArrowUpRightIcon } from './ArrowUpRightIcon';
export { ChatIcon } from './ChatIcon';
export { ChevronDownIcon } from './ChevronDownIcon';
export { ChevronLeftIcon } from './ChevronLeftIcon';
export { ChevronRightIcon } from './ChevronRightIcon';
export { GripVerticalIcon } from './GripVerticalIcon';
export { NoteEditIcon } from './NoteEditIcon';
export { NoteIcon } from './NoteIcon';
export { PauseIcon } from './PauseIcon';
export { PinIcon } from './PinIcon';
export { PlayIcon } from './PlayIcon';
export { ScratchIcon } from './ScratchIcon';
export { SettingsIcon } from './SettingsIcon';
export { StarFilledIcon } from './StarFilledIcon';
export { StarIcon } from './StarIcon';
export { XCloseIcon } from './XCloseIcon';
export { AlertCircleIcon } from './AlertCircleIcon';
export { FileTextIcon } from './FileTextIcon';
export { InboxIcon } from './InboxIcon';
export { LayersIcon } from './LayersIcon';
export { LoaderIcon } from './LoaderIcon';
// Frontend Style Guide v1 (PR3) — spec naming alias (built-in animate-spin).
export { IconLoader } from './IconLoader';
export { RefreshIcon } from './RefreshIcon';
export { FontSizeMinusIcon } from './FontSizeMinusIcon';
export { FontSizePlusIcon } from './FontSizePlusIcon';
export { FormatBoldIcon } from './FormatBoldIcon';
export { FormatCodeIcon } from './FormatCodeIcon';
export { FormatItalicIcon } from './FormatItalicIcon';
export { FormatListIcon } from './FormatListIcon';
export { LinkIcon } from './LinkIcon';
export { ClockIcon } from './ClockIcon';
export { HelpIcon } from './HelpIcon';
export { PenIcon } from './PenIcon';
export { SendIcon } from './SendIcon';
export { StopIcon } from './StopIcon';
export { TrashIcon } from './TrashIcon';
export { LogoutIcon } from './LogoutIcon';
export { WifiOffIcon } from './WifiOffIcon';
export { BarChartIcon } from './BarChartIcon';
export { CpuIcon } from './CpuIcon';
export { LockIcon } from './LockIcon';
export { MailIcon } from './MailIcon';
export { PhoneIcon } from './PhoneIcon';
export { WarningIcon } from './WarningIcon';
export { PanelLeftCloseIcon } from './PanelLeftCloseIcon';
export { PanelLeftOpenIcon } from './PanelLeftOpenIcon';
export { PanelRightCloseIcon } from './PanelRightCloseIcon';
export { PanelRightOpenIcon } from './PanelRightOpenIcon';

// ── Wave 10 Phase C — 社区笔记 (point/comment/favorite/report) ──────────────
export { HeartIcon } from './HeartIcon';
export { HeartFilledIcon } from './HeartFilledIcon';
export { CommentIcon } from './CommentIcon';
export { FlagIcon } from './FlagIcon';

// ── Nav (导航) ─────────────────────────────────────────────────────────────
export { NavPrevIcon } from './NavPrevIcon';
export { NavNextIcon } from './NavNextIcon';
export { NavBackIcon } from './NavBackIcon';
export { NavCloseIcon } from './NavCloseIcon';
export { NavSubmitIcon } from './NavSubmitIcon';
export { NavAnswerCardIcon } from './NavAnswerCardIcon';

// ── Tool (工具) ────────────────────────────────────────────────────────────
export { ToolPauseIcon } from './ToolPauseIcon';
export { ToolPlayIcon } from './ToolPlayIcon';
export { ToolSettingsIcon } from './ToolSettingsIcon';
export { ToolThemeIcon } from './ToolThemeIcon';
export { ToolChatIcon } from './ToolChatIcon';
export { ToolAiIcon } from './ToolAiIcon';
export { ToolScratchIcon } from './ToolScratchIcon';
export { ToolPinIcon } from './ToolPinIcon';
export { ToolSearchIcon } from './ToolSearchIcon';
export { ToolFilterIcon } from './ToolFilterIcon';
export { ToolSortIcon } from './ToolSortIcon';
export { ToolDownloadIcon } from './ToolDownloadIcon';
export { ToolEyeIcon } from './ToolEyeIcon';

// ── Action (用户动作) ──────────────────────────────────────────────────────
export { ActionStarIcon } from './ActionStarIcon';
export { ActionStarFilledIcon } from './ActionStarFilledIcon';
export { ActionMarkIcon } from './ActionMarkIcon';
export { ActionNoteIcon } from './ActionNoteIcon';
export { ActionPlusIcon } from './ActionPlusIcon';
export { ActionNoteEditIcon } from './ActionNoteEditIcon';
export { ActionGripIcon } from './ActionGripIcon';
export { ActionUndoIcon } from './ActionUndoIcon';
export { ActionRedoIcon } from './ActionRedoIcon';

// ── Status (状态) ──────────────────────────────────────────────────────────
export { StatusDoneIcon } from './StatusDoneIcon';
export { StatusWrongIcon } from './StatusWrongIcon';
export { StatusPendingIcon } from './StatusPendingIcon';

// ── Subject (学科) ─────────────────────────────────────────────────────────
export { SubjectXingceIcon } from './SubjectXingceIcon';
export { SubjectEssayIcon } from './SubjectEssayIcon';
export { SubjectWrongbookIcon } from './SubjectWrongbookIcon';
export { SubjectDashboardIcon } from './SubjectDashboardIcon';
export { SubjectPlanIcon } from './SubjectPlanIcon';
export { SubjectProfileIcon } from './SubjectProfileIcon';
export { SubjectHomeIcon } from './SubjectHomeIcon';

// ── Composite (复合编号 — 题号圆 / Mn / Qn) ────────────────────────────────
export { NumberCircle } from './composite/NumberCircle';
export type { NumberCircleProps } from './composite/NumberCircle';
export { NumberSquare } from './composite/NumberSquare';
export type { NumberSquareProps } from './composite/NumberSquare';
export { MaterialBadge } from './composite/MaterialBadge';
export type { MaterialBadgeProps, MaterialStatus } from './composite/MaterialBadge';
export { QuestionBadge } from './composite/QuestionBadge';
export type { QuestionBadgeProps, QuestionStatus } from './composite/QuestionBadge';
export type {
  CommonStatus,
  CommonStatusColors,
  CompositeSize,
} from './composite/_shared';
export {
  COMMON_STATUS_COLORS,
  COMPOSITE_SIZE_PX,
  compositeNumberFontSize,
} from './composite/_shared';
