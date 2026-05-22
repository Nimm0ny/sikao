// Phase 1 UI barrel — import from `@/components/ui` so page-level code
// never reaches into individual component files. Keeping this file typed
// (.ts, not .tsx) ensures react-refresh/only-export-components stays happy:
// no JSX, no non-component re-exports besides types.

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card } from './Card';
export type { CardProps, CardPadding, CardVariant } from './Card';

export { Badge } from './Badge';
export type { BadgeProps, BadgeTone, BadgeVariant } from './Badge';

export { Tabs } from './Tab';
export type { TabsProps, TabItem, TabsVariant } from './Tab';

export { ScoreRing } from './ScoreRing';
export type { ScoreRingProps } from './ScoreRing';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps, ProgressVariant } from './ProgressBar';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { SectionErrorBoundary } from './SectionErrorBoundary';
export type { SectionErrorBoundaryProps } from './SectionErrorBoundary';

export { AuthFallbackEmptyState } from './AuthFallbackEmptyState';
export type { AuthFallbackEmptyStateProps } from './AuthFallbackEmptyState';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

// PR8 (2026-05-13) — `Drawer` 重命名:
// - 旧 Drawer (header / footer / onToggle bottom-pull drawer) → BottomDrawer.
//   Callsites: ExamCustomSheet / AnswerCardDrawerHeader. 行为不变.
// - 新 Drawer (title / side / width / onClose · mobile→BottomSheet 自动) 走
//   Mobile and Tablet Pack New §iv / Handoff §4.4 SSOT.
export { Drawer } from './Drawer';
export type { DrawerProps } from './Drawer';

export { BottomDrawer } from './BottomDrawer';
export type { BottomDrawerProps } from './BottomDrawer';

export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';

export { ImageLightbox } from './ImageLightbox';
export type { ImageLightboxProps } from './ImageLightbox';

export { SidePanel } from './SidePanel';
export type { SidePanelProps } from './SidePanel';

export { Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';

export { Skeleton } from './Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton';

// Phase 5.2 — new editorial primitives per element/preview/*.html.
export { AnswerCell } from './AnswerCell';
export type { AnswerCellProps, AnswerCellStatus } from './AnswerCell';

export { OptionRow } from './OptionRow';
export type { OptionRowProps, OptionStatus } from './OptionRow';

export { FormField } from './FormField';
export type { FormFieldProps } from './FormField';

export { Breadcrumb } from './Breadcrumb';
export type { BreadcrumbProps, BreadcrumbItem } from './Breadcrumb';

export { PipeNav } from './PipeNav';
export type { PipeNavProps, PipeNavItem } from './PipeNav';

export { MetaPair } from './MetaPair';
export type { MetaPairProps } from './MetaPair';

export { StatCallout } from './StatCallout';
export type { StatCalloutProps } from './StatCallout';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';

// SIKAO Phase 1' (2026-05-09) — new editorial primitives per
// design/SIKAO/handoff/design/components.md.
export { IconBtn } from './IconBtn';
export type { IconBtnProps, IconBtnSize, IconBtnVariant } from './IconBtn';

export { Stamp } from './Stamp';
export type { StampProps } from './Stamp';

export { Rail } from './Rail';
export type { RailProps, RailSide } from './Rail';

export { Tooltip } from './Tooltip';
export type { TooltipProps, TooltipSide } from './Tooltip';

// Frontend Style Guide v1 (2026-05-12 PR3) — spec §5 primitives.
// 跟现有 (Badge / IconBtn / Card / StatCallout) 解耦, 新代码优先用本批 primitive.
export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Radio } from './Radio';
export type { RadioProps } from './Radio';

export { Chip } from './Chip';
export type { ChipProps } from './Chip';

export { Pill } from './Pill';
export type { PillProps, PillTone } from './Pill';

export { StatCard } from './StatCard';
export type { StatCardProps, StatDelta, StatDeltaDirection } from './StatCard';

export { Toast } from './Toast';
export type { ToastProps, ToastTone } from './Toast';

export { ToastHost } from './ToastHost';
