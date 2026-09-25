import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { setStatusSchema } from '@/lib/validation/user';
import * as users from '@/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({ permission: 'users.edit', body: setStatusSchema }, async ({ actor, params, body }) => {
  const user = await users.setStatus(actor, params.id, body.isActive);
  return ok(user);
});
