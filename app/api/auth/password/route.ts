import { cookies } from 'next/headers';
import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updatePasswordSchema } from '@/lib/validation/auth';
import { updatePassword } from '@/services/auth';
import { signSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withRoute({ body: updatePasswordSchema }, async ({ actor, body }) => {
  const { user, tokenVersion } = await updatePassword(actor.id, body.currentPassword, body.newPassword);

  const token = await signSessionToken({ sub: actor.id, tv: tokenVersion });
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  return ok(user);
});
