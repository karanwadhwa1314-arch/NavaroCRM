import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
