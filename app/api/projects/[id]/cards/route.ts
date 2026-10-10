import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { createCardSchema } from '@/lib/validation/project';
import * as cards from '@/services/project-cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'projects.view' }, async ({ params }) => ok(await cards.list(params.id)));

export const POST = withRoute({ permission: 'projects.edit', body: createCardSchema }, async ({ actor, params, body }) => {
  return ok(await cards.create(actor, params.id, body), 201);
});
