import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateTeamMemberSchema } from '@/lib/validation/project';
import * as projects from '@/services/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({ permission: 'projects.edit', body: updateTeamMemberSchema }, async ({ actor, params, body }) => {
  return ok(await projects.updateTeamMember(actor, params.id, params.memberId, body));
});

export const DELETE = withRoute({ permission: 'projects.edit' }, async ({ actor, params }) => {
  return ok(await projects.removeTeamMember(actor, params.id, params.memberId));
});
