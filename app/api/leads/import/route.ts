import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { importLeadsBodySchema } from '@/lib/validation/lead';
import * as leads from '@/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same guard as POST /api/leads: importing is just bulk creation.
export const POST = withRoute({ permission: 'leads.create', body: importLeadsBodySchema }, async ({ actor, body }) => {
  const result = await leads.importLeads(actor, body.rows, body.dryRun);
  return ok(result, body.dryRun ? 200 : 201);
});
