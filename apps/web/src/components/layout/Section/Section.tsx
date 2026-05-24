import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './Section.module.css';

/*
 * Section — V5 D.3.33 container (skeleton).
 *
 * Why: light-weight grouping container inside a page. Always a <section>;
 *      the optional title becomes an h3 and is wired via aria-labelledby
 *      (matches §D.3.33 contract — Section is between Panel and bare div).
 *      `spacing` token controls margin-block so two adjacent <Section>s
 *      get the right rhythm without callers hand-tuning gaps.
 */

export type SectionSpacing = 'sm' | 'md' | 'lg';

export interface SectionProps {
  readonly title?: string;
  readonly children: ReactNode;
  readonly spacing?: SectionSpacing;
  readonly 'aria-label'?: string;
}

export function Section({
  title,
  children,
  spacing = 'md',
  'aria-label': ariaLabel,
}: SectionProps) {
  const reactId = useId();
  const titleId = title ? `section-title-${reactId}` : undefined;
  return (
    <section
      className={styles.root}
      data-spacing={spacing}
      data-testid="section"
      aria-labelledby={titleId}
      aria-label={ariaLabel}
    >
      {title !== undefined ? (
        <h3 id={titleId} className={styles.title} data-testid="section-title">
          {title}
        </h3>
      ) : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
