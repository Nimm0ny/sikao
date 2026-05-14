import { Skeleton } from '@sikao/ui/ui';

// Phase 5.4e — WrongBook 三栏骨架。与业务组件边界对齐：左 230px / 中 flex / 右 420px。

export function WrongBookSkeleton() {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[230px_1fr_420px] gap-4 p-4 md:p-6 h-full"
      data-testid="wrong-book-skeleton"
    >
      {/* 左栏 filters */}
      <aside className="space-y-4">
        <Skeleton widthClass="w-20" heightClass="h-3" />
        <div className="space-y-2">
          <Skeleton widthClass="w-full" heightClass="h-8" />
          <Skeleton widthClass="w-full" heightClass="h-8" />
          <Skeleton widthClass="w-full" heightClass="h-8" />
        </div>
        <Skeleton widthClass="w-16" heightClass="h-3" />
        <div className="flex flex-wrap gap-2">
          <Skeleton widthClass="w-20" heightClass="h-7" />
          <Skeleton widthClass="w-16" heightClass="h-7" />
          <Skeleton widthClass="w-20" heightClass="h-7" />
        </div>
      </aside>

      {/* 中栏列表 */}
      <main className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} widthClass="w-full" heightClass="h-28" />
        ))}
      </main>

      {/* 右栏详情 */}
      <aside className="hidden lg:block space-y-4">
        <Skeleton widthClass="w-32" heightClass="h-4" />
        <Skeleton widthClass="w-full" heightClass="h-6" />
        <Skeleton widthClass="w-5/6" heightClass="h-4" />
        <div className="space-y-2 pt-4">
          <Skeleton widthClass="w-full" heightClass="h-12" />
          <Skeleton widthClass="w-full" heightClass="h-12" />
          <Skeleton widthClass="w-full" heightClass="h-12" />
          <Skeleton widthClass="w-full" heightClass="h-12" />
        </div>
      </aside>
    </div>
  );
}
