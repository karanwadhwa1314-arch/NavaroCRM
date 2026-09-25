import { KpiCard } from '@/components/dashboard/KpiCard';

interface ClientStats {
  total: number;
  newThisMonth: number;
  byStatus: Record<string, number>;
}

export function ClientStatsCards({ stats }: { stats: ClientStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total clients" value={stats.total} accent="green" />
      <KpiCard label="Active" value={stats.byStatus.active ?? 0} accent="turquoise" />
      <KpiCard label="New this month" value={stats.newThisMonth} accent="yellow" />
      <KpiCard label="Prospects" value={stats.byStatus.prospect ?? 0} accent="lavender" />
    </div>
  );
}
