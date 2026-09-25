import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { clientContactSchema } from '@/lib/validation/client';
import * as clients from '@/services/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute({ permission: 'clients.edit', body: clientContactSchema }, async ({ actor, params, body }) => {
  const client = await clients.addContact(actor, params.id, body);
  return ok(client, 201);
});
