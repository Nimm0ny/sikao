import { Skeleton } from '@sikao/ui/ui';

export function DashboardSkeleton() {
  return (
    <div
      className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6"
      data-testid="dashboard-skeleton"
    >
      {/* metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} widthClass="w-full" heightClass="h-24" />
        ))}
      </div>
      {/* main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <Skeleton widthClass="w-full" heightClass="h-48" />
          <Skeleton widthClass="w-full" heightClass="h-40" />
        </div>
        <Skeleton widthClass="w-full" heightClass="h-96" />
      </div>
      <Skeleton widthClass="w-full" heightClass="h-56" />
    </div>
  );
}
