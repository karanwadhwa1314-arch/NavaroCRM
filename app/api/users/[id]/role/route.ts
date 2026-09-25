import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { forbidden } from '@/lib/api/errors';
import { changeRoleSchema } from '@/lib/validation/user';
import * as users from '@/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({ body: changeRoleSchema }, async ({ actor, params, body }) => {
  if (actor.role !== 'superadmin') throw forbidden('Only a super admin can change a user role');
  const user = await users.changeRole(actor, params.id, body.role);
  return ok(user);
});
