import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import * as broadcasts from '@/services/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = withRoute({ permission: 'broadcasts.send' }, async ({ actor, params }) => ok(await broadcasts.retry(actor, params.id)));
