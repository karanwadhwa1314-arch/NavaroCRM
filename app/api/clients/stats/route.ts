import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import * as clients from '@/services/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'clients.view' }, async () => {
  const data = await clients.stats();
  return ok(data);
});
