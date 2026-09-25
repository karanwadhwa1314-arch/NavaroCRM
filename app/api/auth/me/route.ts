import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateMeSchema } from '@/lib/validation/auth';
import { updateMe } from '@/services/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({}, async ({ actor }) => ok(actor));

export const PATCH = withRoute({ body: updateMeSchema }, async ({ actor, body }) => {
  const user = await updateMe(actor.id, body);
  return ok(user);
});
