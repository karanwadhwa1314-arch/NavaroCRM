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

  // Stats and assignees don't depend on the session lookup, so run them alongside it
  // instead of after it; the list needs the actor (for assignedTo=me) and follows.
  const [user, stats, assignableUsers] = await Promise.all([
    requirePagePermission('leads.view'),
    leadsService.stats(),
    usersService.assignable(),
  ]);
  const { items, total, page, limit } = await leadsService.list(user, query);

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
