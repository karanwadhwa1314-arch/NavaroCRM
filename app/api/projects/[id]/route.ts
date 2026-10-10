import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateProjectSchema } from '@/lib/validation/project';
import * as projects from '@/services/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'projects.view' }, async ({ params }) => ok(await projects.get(params.id)));

export const PUT = withRoute({ permission: 'projects.edit', body: updateProjectSchema }, async ({ actor, params, body }) => {
  return ok(await projects.update(actor, params.id, body));
});

export const DELETE = withRoute({ permission: 'projects.delete' }, async ({ actor, params }) => {
  return ok(await projects.remove(actor, params.id));
});
