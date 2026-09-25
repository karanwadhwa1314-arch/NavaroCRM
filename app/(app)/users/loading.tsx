import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';

export default function UsersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <TableSkeleton />
    </div>
  );
}
