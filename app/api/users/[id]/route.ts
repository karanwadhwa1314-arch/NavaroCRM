import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateUserSchema } from '@/lib/validation/user';
import * as users from '@/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'users.view' }, async ({ params }) => {
  const user = await users.get(params.id);
  return ok(user);
});

export const PUT = withRoute({ permission: 'users.edit', body: updateUserSchema }, async ({ actor, params, body }) => {
  const user = await users.update(actor, params.id, body);
  return ok(user);
});

export const DELETE = withRoute({ permission: 'users.delete' }, async ({ actor, params }) => {
  await users.remove(actor, params.id);
  return ok({ deleted: true });
});
