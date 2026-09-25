import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import * as leads from '@/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'leads.view' }, async () => {
  const data = await leads.stats();
  return ok(data);
});
