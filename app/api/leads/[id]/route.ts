import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateLeadSchema } from '@/lib/validation/lead';
import * as leads from '@/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'leads.view' }, async ({ params }) => {
  const lead = await leads.get(params.id);
  return ok(lead);
});

export const PUT = withRoute({ permission: 'leads.edit', body: updateLeadSchema }, async ({ actor, params, body }) => {
  const lead = await leads.update(actor, params.id, body);
  return ok(lead);
});

export const DELETE = withRoute({ permission: 'leads.delete' }, async ({ actor, params }) => {
  const result = await leads.remove(actor, params.id);
  return ok(result);
});
