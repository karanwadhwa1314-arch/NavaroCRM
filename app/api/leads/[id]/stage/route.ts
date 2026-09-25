import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { forbidden } from '@/lib/api/errors';
import { updateLeadStageSchema } from '@/lib/validation/lead';
import { hasPermission } from '@/lib/auth/session';
import * as leads from '@/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({ permission: 'leads.edit', body: updateLeadStageSchema }, async ({ actor, params, body }) => {
  if (body.stage === 'won' && !hasPermission(actor, 'clients.create')) {
    throw forbidden('You need permission to create clients to mark a lead as won');
  }
  const lead = await leads.changeStage(actor, params.id, body);
  return ok(lead);
});
