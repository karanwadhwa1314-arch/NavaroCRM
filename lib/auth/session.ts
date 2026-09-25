import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { hasPermission as checkPermission, type Permission } from '@/lib/permissions';
import type { UserRole } from '@/lib/constants';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt';
import { unauthorized, forbidden } from '@/lib/api/errors';

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  phone?: string;
  department?: string;
  lastLogin?: string;
}

/** Reads the cookie, verifies the JWT and reloads the user from the DB. Returns null if anything fails. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  await connectDB();
  const user = await User.findById(payload.sub).lean();
  if (!user) return null;
  if (!user.isActive) return null;
  if ((user.tokenVersion ?? 0) !== payload.tv) return null;

  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    permissions: (user.permissions ?? []) as Permission[],
    phone: user.phone,
    department: user.department,
    lastLogin: user.lastLogin ? user.lastLogin.toISOString() : undefined,
  };
}

/** For server components/layouts. Redirects to /login when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** For server components. Redirects to /dashboard with a toast flag when the permission is missing. */
export async function requirePagePermission(...perms: Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!checkPermission(user, ...perms)) {
    redirect('/dashboard?forbidden=1');
  }
  return user;
}

/** For API route handlers. Throws AppError(401)/(403) instead of redirecting. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireApiPermission(...perms: Permission[]): Promise<SessionUser> {
  const user = await requireApiUser();
  if (!checkPermission(user, ...perms)) throw forbidden();
  return user;
}

export function hasPermission(user: SessionUser, ...perms: Permission[]): boolean {
  return checkPermission(user, ...perms);
}
