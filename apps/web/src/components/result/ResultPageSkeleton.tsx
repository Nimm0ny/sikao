import { Card, Skeleton } from '@sikao/ui/ui';

// Loading placeholder for the Result view. Mirrors the real layout: hero
// (score ring + title + 3 count tiles), section accuracy card (2 rows), and
// a wrong-review card.
//
// Caveat: once the backend fills `section_summaries / answers / questions`
// (see docs/ui-rollout/workrecord/phase3.md §Phase 3.3 后端 blocker), the skeleton's row
// counts should roughly match typical content; right now the deep cards
// render as EmptyState, so the skeleton still looks slightly denser than
// the post-load page. That's acceptable — the point is to not display a
// blank spinner for the 200-300ms query roundtrip.

export function ResultPageSkeleton() {
  return (
    <div
      className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto"
      data-testid="result-loading"
    >
      <HeroSkeleton />
      <SectionAccuracySkeleton />
      <WrongReviewSkeleton />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <Card padding="lg" className="relative overflow-hidden">
      <div className="flex items-center gap-6">
        <Skeleton
          variant="circle"
          widthClass="w-[132px]"
          heightClass="h-[132px]"
        />
        <div className="flex-1 space-y-3">
          <Skeleton widthClass="w-20" heightClass="h-4" />
          <Skeleton widthClass="w-2/3" heightClass="h-7" />
          <Skeleton widthClass="w-1/2" variant="text" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} padding="sm">
            <Skeleton widthClass="w-16" variant="text" />
            <div className="mt-2">
              <Skeleton widthClass="w-10" heightClass="h-6" />
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}

function SectionAccuracySkeleton() {
  return (
    <Card padding="md">
      <Skeleton widthClass="w-24" heightClass="h-5" />
      <div className="mt-3 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton widthClass="w-32" variant="text" />
              <Skeleton widthClass="w-12" variant="text" />
            </div>
            <Skeleton widthClass="w-full" heightClass="h-2" roundedClass="rounded-pill" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function WrongReviewSkeleton() {
  return (
    <Card padding="md">
      <Skeleton widthClass="w-20" heightClass="h-5" />
      <div className="mt-3 space-y-2">
        <Skeleton widthClass="w-full" variant="text" />
        <Skeleton widthClass="w-5/6" variant="text" />
        <Skeleton widthClass="w-3/4" variant="text" />
      </div>
    </Card>
  );
}
