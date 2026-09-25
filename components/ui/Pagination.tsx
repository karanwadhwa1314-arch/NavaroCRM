import { Button } from '@/components/ui/Button';
import type { Pagination as PaginationData } from '@/lib/api/response';

interface PaginationProps {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { total, page, limit, totalPages, hasNextPage, hasPrevPage } = pagination;
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm font-light text-navaro-muted">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" disabled={!hasPrevPage} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <span className="text-navaro-green">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
