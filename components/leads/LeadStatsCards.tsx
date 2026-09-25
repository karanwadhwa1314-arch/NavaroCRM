import { KpiCard } from '@/components/dashboard/KpiCard';

interface LeadStats {
  total: number;
  newThisMonth: number;
  byStage: Record<string, number>;
}

export function LeadStatsCards({ stats }: { stats: LeadStats }) {
  const inProgress = (stats.byStage.qualified ?? 0) + (stats.byStage.proposal ?? 0) + (stats.byStage.negotiation ?? 0);
  const won = stats.byStage.won ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total leads" value={stats.total} accent="green" />
      <KpiCard label="New this month" value={stats.newThisMonth} accent="yellow" />
      <KpiCard label="In progress" value={inProgress} accent="yellow" />
      <KpiCard label="Won" value={won} accent="turquoise" />
    </div>
  );
}
