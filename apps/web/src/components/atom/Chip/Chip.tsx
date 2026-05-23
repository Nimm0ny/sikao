import { Tag } from '../Tag/Tag';
import type { TagProps } from '../Tag/Tag';

/*
 * Chip — V5 D.3.8 atom (skeleton).
 *
 * Why: visually identical to Tag, but semantically marks a user-selected
 *      facet (filter chip / chosen value). Wrapping Tag keeps the visual
 *      surface in one place; Chip's role is the API name.
 */

export type ChipProps = TagProps;

export function Chip(props: ChipProps) {
  return <Tag {...props} />;
}
