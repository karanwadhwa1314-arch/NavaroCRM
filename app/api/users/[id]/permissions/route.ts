import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { forbidden } from '@/lib/api/errors';
import { setPermissionsSchema } from '@/lib/validation/user';
import * as users from '@/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({ body: setPermissionsSchema }, async ({ actor, params, body }) => {
  if (actor.role !== 'superadmin') throw forbidden('Only a super admin can set permissions');
  const user = await users.setPermissions(actor, params.id, body.permissions);
  return ok(user);
});
