import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { assignableUsersQuerySchema } from '@/lib/validation/user';
import * as users from '@/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ query: assignableUsersQuerySchema }, async ({ query }) => {
  const items = await users.assignable(query.search);
  return ok(items);
});
