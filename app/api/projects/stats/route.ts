import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import * as projects from '@/services/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute({ permission: 'projects.view' }, async () => ok(await projects.stats()));
