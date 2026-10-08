import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { createBroadcastSchema } from '@/lib/validation/broadcast';
import * as broadcasts from '@/services/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'broadcasts.view' }, async () => {
  const items = await broadcasts.list();
  return ok({ items, emailConfigured: broadcasts.emailConfigured(), sender: broadcasts.getSenderConfig().email, leadCount: await broadcasts.audienceEstimate() });
});

export const POST = withRoute({ permission: 'broadcasts.create', body: createBroadcastSchema }, async ({ actor, body }) => {
  const created = await broadcasts.create(actor, body);
  return ok(created, 201);
});
