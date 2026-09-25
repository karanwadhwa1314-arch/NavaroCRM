import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import * as usersService from '@/services/users';
import { userListQuerySchema } from '@/lib/validation/user';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { UsersClient } from '@/components/users/UsersClient';
import type { UserRow } from '@/components/users/UserTable';

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requirePagePermission('users.view');
  await connectDB();

  const flatParams = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  const query = userListQuerySchema.parse(flatParams);

  const [{ items, total, page, limit }, stats] = await Promise.all([usersService.list(query), usersService.stats()]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagination = { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };

  return (
    <div className="flex flex-col gap-6">
      <SetPageTitle title="User management" />
      <div>
        <h1 className="text-h1 text-navaro-green">User management</h1>
        <p className="mt-1 text-body text-navaro-muted">Manage users, roles and permissions</p>
      </div>

      <UsersClient items={items as unknown as UserRow[]} pagination={pagination} stats={stats} />
    </div>
  );
}
