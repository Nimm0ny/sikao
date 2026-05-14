import type { ReactElement } from 'react';
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import { useOrientation } from '@sikao/shared-utils/hooks/useOrientation';
import { useInputMode, type InputMode } from '@sikao/shared-utils/hooks/useInputMode';
import TabletLandscapeShell from './tabletLandscapeShell';
import TabletPortraitShell from './tabletPortraitShell';
import DesktopFallback from './desktopFallback';

// ShenlunSession — device-aware shell dispatcher (PR13 P1, 2026-05-13).
//
// Routes /practice/essay/session/:sessionId to one of three sub-layouts:
//   - TD1  (tablet landscape, typed)        → TabletLandscapeShell mode='typed'
//   - TD1b (tablet landscape, handwritten)  → TabletLandscapeShell mode='handwritten'
//   - TD2  (tablet portrait)                → TabletPortraitShell
//   - else (desktop / mobile)               → DesktopFallback
//
// Mode comes from useInputMode() (event-driven, no UI toggle per handoff §2.2).
// Sub-shells in PR1 are placeholders; P2-P4 fills in TopBar / MaterialPane /
// editors.

function selectLandscapeMode(mode: InputMode): Extract<InputMode, 'typed' | 'handwritten'> {
  // idle → typed default (no pen signal yet; user lands on textarea).
  // handwritten only after a primary pen pointerdown (TD1b branch).
  return mode === 'handwritten' ? 'handwritten' : 'typed';
}

export default function ShenlunSession(): ReactElement {
  const device = useDevice();
  const orientation = useOrientation();
  const { mode } = useInputMode();

  if (device !== 'tablet') {
    return <DesktopFallback />;
  }
  if (orientation === 'portrait') {
    return <TabletPortraitShell />;
  }
  return <TabletLandscapeShell mode={selectLandscapeMode(mode)} />;
}
