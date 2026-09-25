import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import { withRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { loginSchema } from '@/lib/validation/auth';
import { login } from '@/services/auth';
import { signSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute({ body: loginSchema, requireAuth: false }, async ({ body }) => {
  await connectDB();
  const { user, tokenVersion, userId } = await login(body.email, body.password);

  const token = await signSessionToken({ sub: userId, tv: tokenVersion });
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  return ok(user);
});
