import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import * as leadsService from '@/services/leads';
import * as usersService from '@/services/users';
import { leadListQuerySchema } from '@/lib/validation/lead';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { LeadStatsCards } from '@/components/leads/LeadStatsCards';
import { LeadsClient } from '@/components/leads/LeadsClient';
import type { LeadRow } from '@/components/leads/LeadTable';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await connectDB();

  const flatParams = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  const query = leadListQuerySchema.parse(flatParams);

  // Start everything at once, but only wait for the session before the list query (it needs the
  // actor for assignedTo=me). Stats are the slowest query, so they must overlap the list, not precede it.
  const userP = requirePagePermission('leads.view');
  const statsP = leadsService.stats();
  const assignableP = usersService.assignable();
  statsP.catch(() => {}); // avoid an unhandled rejection if the permission check redirects first
  assignableP.catch(() => {});
  const user = await userP;
  const { items, total, page, limit } = await leadsService.list(user, query);
  const [stats, assignableUsers] = await Promise.all([statsP, assignableP]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagination = {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  const hasFilters = Boolean(query.search || query.stage || query.source || query.priority || query.assignedTo);

  return (
    <div className="flex flex-col gap-6">
      <SetPageTitle title="Leads" />
      <div>
        <h1 className="text-h1 text-navaro-green">Leads</h1>
        <p className="mt-1 text-body text-navaro-muted">Track and manage your sales pipeline</p>
      </div>

      <LeadStatsCards stats={stats} />

      <LeadsClient
        items={items as unknown as LeadRow[]}
        pagination={pagination}
        assignableUsers={assignableUsers}
        hasFilters={hasFilters}
      />
    </div>
  );
}
