// Skeleton state shown while the practice store is rehydrating between the
// PracticeStart redirect and the initial render. Kept dumb so we can reuse
// it from the Result page if/when it grows the same loading shape.

export function SessionLoading() {
  return (
    <div
      className="min-h-[40vh] flex items-center justify-center text-ink-3 text-sm"
      data-testid="session-loading"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-pill border-4 border-ink-1 border-t-transparent animate-spin"
        />
        正在加载套卷蓝图...
      </div>
    </div>
  );
}
