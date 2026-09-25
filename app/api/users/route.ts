import { withRoute } from '@/lib/api/handler';
import { paginated, ok } from '@/lib/api/response';
import { createUserSchema, userListQuerySchema } from '@/lib/validation/user';
import * as users from '@/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'users.view', query: userListQuerySchema }, async ({ query }) => {
  const { items, total, page, limit } = await users.list(query);
  return paginated(items, total, page, limit);
});

export const POST = withRoute({ permission: 'users.create', body: createUserSchema }, async ({ actor, body }) => {
  const user = await users.create(actor, body);
  return ok(user, 201);
});
