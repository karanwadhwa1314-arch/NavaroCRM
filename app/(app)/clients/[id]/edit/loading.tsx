import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';

export default function ClientEditLoading() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
