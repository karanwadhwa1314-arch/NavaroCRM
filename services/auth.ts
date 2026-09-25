import 'server-only';
import User, { type UserDocument } from '@/models/User';
import AuditLog from '@/models/AuditLog';
import { comparePassword } from '@/lib/auth/password';
import { recordAudit } from '@/services/audit';
import { AppError } from '@/lib/api/errors';
import type { SessionUser } from '@/lib/auth/session';
import type { Permission } from '@/lib/permissions';

const THROTTLE_LIMIT = 10;
const THROTTLE_WINDOW_MS = 60 * 60 * 1000;

function toSessionUser(user: UserDocument): SessionUser {
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

async function isThrottled(email: string): Promise<boolean> {
  const since = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const count = await AuditLog.countDocuments({
    action: 'failed_login',
    'metadata.email': email,
    createdAt: { $gte: since },
  });
  return count >= THROTTLE_LIMIT;
}

export async function login(email: string, password: string): Promise<{ user: SessionUser; tokenVersion: number; userId: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  if (await isThrottled(normalizedEmail)) {
    throw new AppError(429, 'Too many login attempts. Please try again later.');
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    await recordAudit({ action: 'failed_login', entity: 'auth', metadata: { email: normalizedEmail } });
    throw new AppError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw new AppError(401, 'Your account has been deactivated');
  }

  const matches = await comparePassword(password, user.password);
  if (!matches) {
    await recordAudit({ action: 'failed_login', entity: 'auth', metadata: { email: normalizedEmail } });
    throw new AppError(401, 'Invalid credentials');
  }

  user.lastLogin = new Date();
  await user.save();

  await recordAudit({ user: String(user._id), action: 'login', entity: 'auth' });

  return { user: toSessionUser(user), tokenVersion: user.tokenVersion, userId: String(user._id) };
}

export async function logout(actorId: string | undefined): Promise<void> {
  await recordAudit({ user: actorId, action: 'logout', entity: 'auth' });
}

export async function updateMe(actorId: string, input: { firstName?: string; lastName?: string; email?: string; phone?: string; department?: string }): Promise<SessionUser> {
  const user = await User.findById(actorId);
  if (!user) throw new AppError(404, 'Resource not found');

  if (input.email && input.email !== user.email) {
    const existing = await User.findOne({ email: input.email, _id: { $ne: user._id } });
    if (existing) throw new AppError(409, 'A user with this email already exists');
    user.email = input.email;
  }
  if (input.firstName !== undefined) user.firstName = input.firstName;
  if (input.lastName !== undefined) user.lastName = input.lastName;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.department !== undefined) user.department = input.department;

  await user.save();
  await recordAudit({ user: actorId, action: 'update', entity: 'user', entityId: actorId, description: 'Updated own profile' });

  return toSessionUser(user);
}

export async function updatePassword(actorId: string, currentPassword: string, newPassword: string): Promise<{ user: SessionUser; tokenVersion: number }> {
  const user = await User.findById(actorId).select('+password');
  if (!user) throw new AppError(404, 'Resource not found');

  const matches = await comparePassword(currentPassword, user.password);
  if (!matches) throw new AppError(401, 'Current password is incorrect');

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  await recordAudit({ user: actorId, action: 'update', entity: 'user', entityId: actorId, description: 'Changed own password' });

  return { user: toSessionUser(user), tokenVersion: user.tokenVersion };
}
