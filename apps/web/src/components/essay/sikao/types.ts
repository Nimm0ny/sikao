// SIKAO essay V3 types — extends existing Paper / Question / Material from
// features/essay-exam/types.ts. Adds clip / cite / note primitives needed by
// the SIKAO double-column layout (MaterialClip → ScratchClip → Citation).
//
// We reuse Paper / Question / Material directly from features/essay-exam to
// keep the existing LLM grading link intact (EssayClient.submit consumes
// Paper.questions[].backendId). New primitives below are isolated to the
// SIKAO presentation layer.

export interface ScratchClip {
  // Stable id — generated when MaterialClip is dragged to ScratchPad. Used as
  // React key, store dedupe key, and Citation.cliId backref.
  readonly id: string;
  // Source material id (matches Material.id from existing types).
  readonly matId: string;
  // Material body slice indices [start, end) — anchors the clip back to the
  // original passage so spec verbiage like "M2·段三" can be derived even when
  // the material body changes. Persisted via the existing snapshot pipeline.
  readonly start: number;
  readonly end: number;
  // The literal short phrase the user dragged (already sliced from body).
  readonly text: string;
  // Pretty source label "M2·段三" — pre-computed at drag time so ScratchClip
  // doesn't need to walk paragraph offsets at render. format: M{idx+1}·段{N}.
  readonly sourceLabel: string;
  // Append order — used by ScratchPad to render top-to-bottom in drop order.
  readonly position: number;
  // Wall-clock timestamp for sort stability across page reloads.
  readonly addedAt: number;
}

export interface ScratchNote {
  // Free-form sticky-note authored by user (separate from ScratchClip which
  // is sourced from MaterialPanel). paper-3 background per spec.
  readonly id: string;
  readonly body: string;
  readonly position: number;
  readonly addedAt: number;
}

export interface Citation {
  // One citation per drop into EditorPanel textarea. EditorPanel inserts
  // 《引文》[M2·段三] inline at caret; this Citation row records the linkback
  // so cite-bar can scroll the user back to the originating ScratchClip.
  readonly id: string;
  readonly clipId?: string; // backref into scratchClips (undefined for plain pastes)
  readonly text: string;
  readonly sourceLabel: string;
  readonly insertedAt: number;
}

// Drag payload — written to dataTransfer alongside text/plain fallback. The
// custom MIME type prevents foreign drops (browser address bar, OS file) from
// looking like clip drops.
export interface EssayClipDragPayload {
  readonly clipId?: string;
  readonly matId: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly sourceLabel: string;
}

export const ESSAY_CLIP_MIME = 'application/x-essay-clip';
