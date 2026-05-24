/*
 * SpriteIcon — V5 sprite consumer helper.
 *
 * Why: V5-M4 (SIK-76) shipped 36 SVG icon sources at
 *      `packages/design-system/src/icons/*.svg` compiled into the sprite
 *      `apps/web/public/icons.svg`. Consuming a sprite symbol from React
 *      is a 5-line `<svg width height aria-hidden><use href ... /></svg>`
 *      boilerplate; centralising it here removes the 5 inline copies
 *      that landed across V5-M3.5 view skeletons (RootLayout NAV_ICONS /
 *      OptionItem Check+Close / Note Star / QuestionHub StateGlyph /
 *      Review StateGlyph) before the sprite was ready.
 *
 *      The component is a thin wrapper, not an opinionated icon
 *      registry — it does not enumerate valid sprite ids in a TS union
 *      because that would couple this file to the build script's sprite
 *      output. Callers pass the raw symbol id (e.g. `nav-home`,
 *      `check-filled`) and the build script's `lint-icon-style.mjs` is
 *      the truth source for which ids exist.
 *
 *      `aria-hidden` defaults to true (the sprite icon is decorative);
 *      callers that need an accessible name pass `aria-label` instead,
 *      which flips the underlying svg to `aria-hidden=false` automatically.
 */

const DEFAULT_SIZE = 18;

export interface SpriteIconProps {
  readonly id: string;
  readonly size?: number;
  /**
   * When provided, the SVG carries this aria-label (and aria-hidden is
   * NOT emitted, so SR reads the label). Use for stand-alone icon-only
   * affordances; for icons paired with a sibling label keep this empty
   * and rely on the sibling text.
   */
  readonly 'aria-label'?: string;
  readonly className?: string;
}

export function SpriteIcon({
  id,
  size = DEFAULT_SIZE,
  'aria-label': ariaLabel,
  className,
}: SpriteIconProps) {
  const isLabeled = ariaLabel !== undefined && ariaLabel.length > 0;
  return (
    <svg
      width={size}
      height={size}
      focusable="false"
      aria-hidden={isLabeled ? undefined : true}
      aria-label={ariaLabel}
      role={isLabeled ? 'img' : undefined}
      className={className}
    >
      <use href={`/icons.svg#${id}`} />
    </svg>
  );
}
