import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateCardSchema } from '@/lib/validation/project';
import * as cards from '@/services/project-cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({ permission: 'projects.edit', body: updateCardSchema }, async ({ actor, params, body }) => {
  return ok(await cards.update(actor, params.id, params.cardId, body));
});

export const DELETE = withRoute({ permission: 'projects.delete' }, async ({ actor, params }) => {
  return ok(await cards.remove(actor, params.id, params.cardId));
});
