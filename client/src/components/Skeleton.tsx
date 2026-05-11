/**
 * Loading skeleton components used while async data is in flight.
 *
 * Using pulsing placeholders instead of a spinner gives the user a sense of
 * the layout before content arrives, which reduces perceived loading time.
 *
 * Three exports:
 * - Skeleton: a single configurable gray block.
 * - CardSkeleton: mimics an ApplicationCard while the list loads.
 * - BulletSkeleton: mimics the side-by-side bullet columns while Claude responds.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}

export function BulletSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map((col) => (
        <div key={col} className="space-y-3">
          <Skeleton className="h-3 w-16" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ))}
    </div>
  );
}
