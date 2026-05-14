// Shared icon prop contract — every icon is a tiny stateless SVG component
// that respects currentColor. Stroke-based icons default to width 1.4
// (SIKAO design SSOT, see design/SIKAO/extracted/inline-svgs.md §CSS Rules).
//
// Why size + className over fill/stroke props: caller controls color via
// className `text-*` utility (inherits to currentColor). This keeps the icon
// API tiny and consistent, while letting Tailwind tokens own the palette.

export interface IconProps {
  readonly size?: number;
  readonly className?: string;
}
