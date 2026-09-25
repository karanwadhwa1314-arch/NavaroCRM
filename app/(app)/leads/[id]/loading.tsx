import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';

export default function LeadDetailLoading() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="flex flex-col gap-6">
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
