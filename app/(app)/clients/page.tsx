import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import * as clientsService from '@/services/clients';
import * as usersService from '@/services/users';
import { clientListQuerySchema } from '@/lib/validation/client';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { ClientStatsCards } from '@/components/clients/ClientStatsCards';
import { ClientsClient } from '@/components/clients/ClientsClient';
import type { ClientRow } from '@/components/clients/ClientTable';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await connectDB();

  const flatParams = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  const query = clientListQuerySchema.parse(flatParams);

  const [user, stats, assignableUsers] = await Promise.all([
    requirePagePermission('clients.view'),
    clientsService.stats(),
    usersService.assignable(),
  ]);
  const { items, total, page, limit } = await clientsService.list(user, query);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagination = { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };

  const hasFilters = Boolean(query.search || query.status || query.tier || query.accountManager || query.industry);

  return (
    <div className="flex flex-col gap-6">
      <SetPageTitle title="Clients" />
      <div>
        <h1 className="text-h1 text-navaro-green">Clients</h1>
        <p className="mt-1 text-body text-navaro-muted">Manage your client relationships</p>
      </div>

      <ClientStatsCards stats={stats} />

      <ClientsClient
        items={items as unknown as ClientRow[]}
        pagination={pagination}
        assignableUsers={assignableUsers}
        hasFilters={hasFilters}
      />
    </div>
  );
}
