// SIKAO V3 申论 — public API. Re-exports the components + types parent
// views need. Internal helpers (clipId, sourceLabel) stay non-exported.

export { EssayGrid } from './EssayGrid';
export type { EssayGridProps } from './EssayGrid';

export { EssayTopbar } from './EssayTopbar';
export { MaterialPanel } from './MaterialPanel';
export type { MaterialPanelProps } from './MaterialPanel';
export { MaterialClip } from './MaterialClip';
export type { MaterialClipProps } from './MaterialClip';
export { ScratchPad } from './ScratchPad';
export { ScratchClip } from './ScratchClip';
export type { ScratchClipProps } from './ScratchClip';
export { ScratchNote } from './ScratchNote';
export type { ScratchNoteProps } from './ScratchNote';
export { CiteBar } from './CiteBar';
export type { CiteBarProps } from './CiteBar';
export { EditorPanel } from './EditorPanel';
export { MmStrip } from './MmStrip';
export type { MaterialStripItem, QuestionStripItem } from './MmStrip';
export { DropMarker } from './DropMarker';
export { EssayShellSikao } from './EssayShellSikao';

export type {
  ScratchClip as ScratchClipModel,
  ScratchNote as ScratchNoteModel,
  Citation,
  EssayClipDragPayload,
} from './types';
export { ESSAY_CLIP_MIME } from './types';
