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
  const user = await requirePagePermission('leads.view');
  await connectDB();

  const flatParams = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  const query = leadListQuerySchema.parse(flatParams);

  const [{ items, total, page, limit }, stats, assignableUsers] = await Promise.all([
    leadsService.list(user, query),
    leadsService.stats(),
    usersService.assignable(),
  ]);

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
