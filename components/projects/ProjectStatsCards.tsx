import { KpiCard } from '@/components/dashboard/KpiCard';
import { PROJECT_HEALTH_LABELS, type ProjectHealthLevel } from '@/lib/constants';

interface ProjectStats {
  total: number;
  health: Record<ProjectHealthLevel, number>;
}

export function ProjectStatsCards({ stats }: { stats: ProjectStats }) {
  return (
    <section aria-label="Project health summary">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={`${PROJECT_HEALTH_LABELS.perfect} health`} value={stats.health.perfect} accent="green" />
        <KpiCard label={`${PROJECT_HEALTH_LABELS.good} health`} value={stats.health.good} accent="turquoise" />
        <KpiCard label={`${PROJECT_HEALTH_LABELS.average} health`} value={stats.health.average} accent="yellow" />
        <KpiCard label={`${PROJECT_HEALTH_LABELS.critical} health`} value={stats.health.critical} accent="danger" />
      </div>
      <p className="mt-2 text-label text-navaro-muted">
        Counts projects in planning, in progress or review. Health drops 5% for each missed card deadline, plus 5% for every further day it stays overdue.
      </p>
    </section>
  );
}
