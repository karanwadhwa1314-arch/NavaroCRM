import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { forbidden } from '@/lib/api/errors';
import * as users from '@/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({}, async ({ actor, params }) => {
  if (actor.role !== 'superadmin') throw forbidden('Only a super admin can reset permissions');
  const user = await users.resetPermissions(actor, params.id);
  return ok(user);
});
