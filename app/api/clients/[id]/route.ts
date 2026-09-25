import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateClientSchema } from '@/lib/validation/client';
import * as clients from '@/services/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'clients.view' }, async ({ params }) => {
  const client = await clients.get(params.id);
  return ok(client);
});

export const PUT = withRoute({ permission: 'clients.edit', body: updateClientSchema }, async ({ actor, params, body }) => {
  const client = await clients.update(actor, params.id, body);
  return ok(client);
});

export const DELETE = withRoute({ permission: 'clients.delete' }, async ({ actor, params }) => {
  const result = await clients.remove(actor, params.id);
  return ok(result);
});
