import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import * as broadcasts from '@/services/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Sends as much as fits (the service budgets ~40s); the scheduler continues anything left.
export const maxDuration = 60;

/** Broadcast now. */
export const POST = withRoute({ permission: 'broadcasts.send' }, async ({ actor, params }) => ok(await broadcasts.sendNow(actor, params.id)));
