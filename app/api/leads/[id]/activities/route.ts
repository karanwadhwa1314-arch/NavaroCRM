import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { addLeadActivitySchema } from '@/lib/validation/lead';
import * as leads from '@/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute({ permission: 'leads.edit', body: addLeadActivitySchema }, async ({ actor, params, body }) => {
  const lead = await leads.addActivity(actor, params.id, body);
  return ok(lead, 201);
});
