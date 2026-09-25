import { withRoute } from '@/lib/api/handler';
import { paginated, ok } from '@/lib/api/response';
import { createLeadSchema, leadListQuerySchema } from '@/lib/validation/lead';
import * as leads from '@/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'leads.view', query: leadListQuerySchema }, async ({ actor, query }) => {
  const { items, total, page, limit } = await leads.list(actor, query);
  return paginated(items, total, page, limit);
});

export const POST = withRoute({ permission: 'leads.create', body: createLeadSchema }, async ({ actor, body }) => {
  const lead = await leads.create(actor, body);
  return ok(lead, 201);
});
