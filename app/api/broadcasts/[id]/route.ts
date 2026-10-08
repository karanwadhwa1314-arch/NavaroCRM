import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateBroadcastSchema } from '@/lib/validation/broadcast';
import * as broadcasts from '@/services/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'broadcasts.view' }, async ({ params }) => ok(await broadcasts.get(params.id)));

export const PUT = withRoute({ permission: 'broadcasts.edit', body: updateBroadcastSchema }, async ({ actor, params, body }) =>
  ok(await broadcasts.update(actor, params.id, body))
);

export const DELETE = withRoute({ permission: 'broadcasts.delete' }, async ({ actor, params }) => {
  await broadcasts.remove(actor, params.id);
  return ok({ deleted: true });
});
