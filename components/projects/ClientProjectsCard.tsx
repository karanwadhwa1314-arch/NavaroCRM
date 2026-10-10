import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProjectStatusBadge } from '@/components/ui/StatusBadge';
import { HealthMeter } from '@/components/projects/HealthMeter';
import { formatDate } from '@/lib/format';
import type { ProjectHealthLevel, ProjectStatus } from '@/lib/constants';

export interface ClientProject {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  startDate: string | Date;
  deadlineHealth: number;
  healthLevel: ProjectHealthLevel;
}

/** Projects of one client, shown on the client page. Read-only; everything else happens on the project. */
export function ClientProjectsCard({ clientId, projects, canCreate }: { clientId: string; projects: ClientProject[]; canCreate: boolean }) {
  return (
    <Card padding={false}>
      <CardHeader
        title="Projects"
        action={
          <div className="flex items-center gap-4">
            {projects.length > 0 && (
              <Link href={`/projects?client=${clientId}`} className="text-sm text-navaro-green underline underline-offset-2">
                View all
              </Link>
            )}
            {canCreate && (
              <Link href={`/projects?client=${clientId}&new=1`} className="text-sm font-medium text-navaro-green underline underline-offset-2">
                New project
              </Link>
            )}
          </div>
        }
      />
      <div className="p-6">
        {projects.length === 0 ? (
          <p className="text-body text-navaro-muted">No projects for this client yet.</p>
        ) : (
          <ul className="divide-y divide-navaro-line">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navaro-green">{p.name}</p>
                    <p className="text-label text-navaro-muted">
                      {p.code} · Started {formatDate(p.startDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <HealthMeter percentage={p.deadlineHealth} level={p.healthLevel} />
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
