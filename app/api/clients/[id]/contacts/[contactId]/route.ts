import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { clientContactUpdateSchema } from '@/lib/validation/client';
import * as clients from '@/services/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute(
  { permission: 'clients.edit', body: clientContactUpdateSchema },
  async ({ actor, params, body }) => {
    const client = await clients.updateContact(actor, params.id, params.contactId, body);
    return ok(client);
  }
);

export const DELETE = withRoute({ permission: 'clients.edit' }, async ({ actor, params }) => {
  const client = await clients.removeContact(actor, params.id, params.contactId);
  return ok(client);
});
