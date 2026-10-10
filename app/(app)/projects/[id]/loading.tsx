import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function ProjectDetailLoading() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-8 w-80" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <CardSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}
