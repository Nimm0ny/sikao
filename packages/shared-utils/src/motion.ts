// Phase 4.2 — single source of motion constants. Every framer-motion call in
// the app must import from here; hard-coded `duration: 0.35` / inline spring
// configs are banned so we don't drift between components.
//
// Why three tiers instead of one: Tab indicator needs sub-frame snap (fast),
// route fade wants noticeable but brisk (base), Drawer slide-up deserves the
// weighty feel of ~280ms (slow). Collapsing them to one duration flattens
// the UX hierarchy.
//
// Accessibility: framer-motion reads `prefers-reduced-motion` automatically
// and shortens these values at runtime. No extra hook needed at this stage
// (see phase4-plan §5.4).

export const MOTION_DURATION = {
  /** Tab indicator, card press, badge pulse. */
  fast: 0.12,
  /** Route transitions, Modal fade/scale. */
  base: 0.18,
  /** Drawer slide-up, large panel entries. */
  slow: 0.28,
} as const;

/**
 * Soft spring — used for the Drawer slide-up and the Tab indicator layout
 * shift. Stiff enough to feel snappy, damped enough to not overshoot.
 */
export const MOTION_SPRING_SOFT = {
  type: 'spring',
  stiffness: 320,
  damping: 30,
  mass: 0.8,
} as const;

/**
 * Route-level fade + slight vertical lift. Mirrors the Codex demo's page
 * transitions: content enters from slightly below, exits slightly above.
 */
export const VIEW_FADE_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
} as const;

/**
 * Modal backdrop + panel pair. Backdrop fades, panel fades + scales slightly
 * to cue the focus shift.
 */
export const MODAL_BACKDROP_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export const MODAL_PANEL_VARIANTS = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
} as const;
