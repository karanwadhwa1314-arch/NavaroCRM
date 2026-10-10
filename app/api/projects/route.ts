import { withRoute } from '@/lib/api/handler';
import { ok, paginated } from '@/lib/api/response';
import { createProjectSchema, projectListQuerySchema } from '@/lib/validation/project';
import * as projects from '@/services/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'projects.view', query: projectListQuerySchema }, async ({ actor, query }) => {
  const { items, total, page, limit } = await projects.list(actor, query);
  return paginated(items, total, page, limit);
});

export const POST = withRoute({ permission: 'projects.create', body: createProjectSchema }, async ({ actor, body }) => {
  const project = await projects.create(actor, body);
  return ok(project, 201);
});
