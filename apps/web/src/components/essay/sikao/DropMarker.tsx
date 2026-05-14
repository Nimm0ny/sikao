// DropMarker — virtual insertion indicator (1px dashed accent line). Used by
// ScratchPad to hint where a dropped clip will land. Visibility is driven by
// the parent's `data-dropping="true"` attribute (CSS-only, see
// sikao-essay.css).
//
// Pure presentation; no props beyond optional className for layout tweaks.

export function DropMarker({ className }: { readonly className?: string }) {
  return (
    <div
      className={`essay-drop-marker ${className ?? ''}`.trim()}
      aria-hidden="true"
      data-testid="essay-drop-marker"
    />
  );
}
