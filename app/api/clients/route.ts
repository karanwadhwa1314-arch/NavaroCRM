import { withRoute } from '@/lib/api/handler';
import { paginated, ok } from '@/lib/api/response';
import { createClientSchema, clientListQuerySchema } from '@/lib/validation/client';
import * as clients from '@/services/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'clients.view', query: clientListQuerySchema }, async ({ actor, query }) => {
  const { items, total, page, limit } = await clients.list(actor, query);
  return paginated(items, total, page, limit);
});

export const POST = withRoute({ permission: 'clients.create', body: createClientSchema }, async ({ actor, body }) => {
  const client = await clients.create(actor, body);
  return ok(client, 201);
});
