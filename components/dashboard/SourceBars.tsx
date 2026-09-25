import { LEAD_SOURCE_LABELS, type LeadSource } from '@/lib/constants';

interface SourceBarsProps {
  items: { source: string; count: number }[];
}

export function SourceBars({ items }: SourceBarsProps) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((i) => i.count));

  if (sorted.length === 0) {
    return <p className="text-body text-navaro-muted">No leads yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map(({ source, count }) => (
        <div key={source} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-label text-navaro-muted">
            {LEAD_SOURCE_LABELS[source as LeadSource] ?? source}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-navaro-heath">
            <div
              className="flex h-full items-center justify-end rounded-r-full bg-navaro-green px-2 text-label font-medium text-navaro-heath"
              style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
            >
              {count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
