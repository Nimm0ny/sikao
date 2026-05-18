import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

export interface FbLayoutProps {
  readonly readingCol: ReactNode;
  readonly scratchCol?: ReactNode;
}

export function FbLayout({ readingCol, scratchCol }: FbLayoutProps) {
  return (
    <main
      className={cn(
        'mx-auto grid w-full max-w-[1500px] grid-cols-1 items-start gap-6 px-4 py-3 pb-36 md:px-6',
        'lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] xl-laptop:grid-cols-[minmax(0,1fr)_minmax(0,320px)]',
      )}
      data-testid="fb-layout"
    >
      <section className="min-w-0">{readingCol}</section>
      {scratchCol !== undefined ? (
        <div className="hidden min-w-0 md:block">{scratchCol}</div>
      ) : null}
    </main>
  );
}
