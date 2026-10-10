import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import * as projectsService from '@/services/projects';
import * as usersService from '@/services/users';
import { projectListQuerySchema } from '@/lib/validation/project';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { ProjectStatsCards } from '@/components/projects/ProjectStatsCards';
import { ProjectsClient } from '@/components/projects/ProjectsClient';
import type { ProjectRow } from '@/components/projects/ProjectTable';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await connectDB();

  const flatParams = Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const query = projectListQuerySchema.parse(flatParams);

  // See clients/page.tsx: overlap the independent lookups with the list rather than running them first.
  const userP = requirePagePermission('projects.view');
  const statsP = projectsService.stats();
  const assignableP = usersService.assignable();
  const clientsP = projectsService.clientOptions();
  statsP.catch(() => {});
  assignableP.catch(() => {});
  clientsP.catch(() => {});
  const user = await userP;
  const { items, total, page, limit } = await projectsService.list(user, query);
  const [stats, assignableUsers, clients] = await Promise.all([statsP, assignableP, clientsP]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagination = { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
  const hasFilters = Boolean(query.search || query.status || query.priority || query.client || query.projectManager || query.teamMember);

  return (
    <div className="flex flex-col gap-6">
      <SetPageTitle title="Projects" />
      <div>
        <h1 className="text-h1 text-navaro-green">Projects</h1>
        <p className="mt-1 text-body text-navaro-muted">Track client work, cards and deadlines. Projects with the weakest health are listed first.</p>
      </div>

      <ProjectStatsCards stats={stats} />

      <ProjectsClient
        items={items as unknown as ProjectRow[]}
        pagination={pagination}
        clients={clients}
        assignableUsers={assignableUsers}
        hasFilters={hasFilters}
      />
    </div>
  );
}
