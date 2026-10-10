import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { addTeamMemberSchema } from '@/lib/validation/project';
import * as projects from '@/services/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute({ permission: 'projects.edit', body: addTeamMemberSchema }, async ({ actor, params, body }) => {
  return ok(await projects.addTeamMember(actor, params.id, body), 201);
});
