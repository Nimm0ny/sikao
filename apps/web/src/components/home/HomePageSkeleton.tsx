import { Card, Skeleton } from '@sikao/ui/ui';

// Loading placeholder for the Home view. Mirrors the real layout block-for-
// block: hero card (badge + headline + two lines of description + two CTA
// buttons), then a 3-tile stats row, then a 1/2/3-column paper grid.
//
// Kept visually close to the real content so the transition from skeleton to
// data doesn't reshuffle the layout — users see the same frame shape.

export function HomePageSkeleton() {
  return (
    <div
      className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto"
      data-testid="home-loading"
    >
      <HeroSkeleton />
      <StatsSkeleton />
      <PaperListSkeleton />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <Card padding="lg">
      <Skeleton widthClass="w-32" heightClass="h-5" roundedClass="rounded-pill" />
      <div className="mt-4 space-y-2">
        <Skeleton widthClass="w-3/4" heightClass="h-7" />
        <Skeleton widthClass="w-2/3" heightClass="h-7" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton widthClass="w-full" variant="text" />
        <Skeleton widthClass="w-5/6" variant="text" />
      </div>
      <div className="mt-5 flex gap-3">
        <Skeleton widthClass="w-28" heightClass="h-10" roundedClass="rounded-tiny" />
        <Skeleton widthClass="w-36" heightClass="h-10" roundedClass="rounded-tiny" />
      </div>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} padding="sm">
          <Skeleton widthClass="w-24" variant="text" />
          <div className="mt-2">
            <Skeleton widthClass="w-16" heightClass="h-7" />
          </div>
          <div className="mt-3">
            <Skeleton widthClass="w-40" variant="text" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function PaperListSkeleton() {
  return (
    <section className="space-y-3">
      <Skeleton widthClass="w-20" heightClass="h-5" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} padding="md">
            <div className="flex items-start justify-between gap-2">
              <Skeleton widthClass="w-12" heightClass="h-5" roundedClass="rounded-pill" />
              <Skeleton widthClass="w-16" variant="text" />
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton widthClass="w-3/4" heightClass="h-5" />
              <Skeleton widthClass="w-full" variant="text" />
              <Skeleton widthClass="w-4/5" variant="text" />
            </div>
            <div className="mt-4">
              <Skeleton widthClass="w-24" heightClass="h-9" roundedClass="rounded-tiny" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
