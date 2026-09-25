import { cookies } from 'next/headers';
import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { logout } from '@/services/auth';
import { SESSION_COOKIE } from '@/lib/auth/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute({}, async ({ actor }) => {
  await logout(actor.id);
  cookies().delete(SESSION_COOKIE);
  return ok({ loggedOut: true });
});
