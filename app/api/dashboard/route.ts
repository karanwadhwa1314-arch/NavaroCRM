import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { getDashboard } from '@/services/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({}, async ({ actor }) => {
  const data = await getDashboard(actor);
  return ok(data);
});
