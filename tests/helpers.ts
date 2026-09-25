import User from '@/models/User';
import { roleDefaultPermissions, type Permission } from '@/lib/permissions';
import type { UserRole } from '@/lib/constants';
import type { SessionUser } from '@/lib/auth/session';

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}@example.com`;
}

export async function createTestUser(opts: {
  role?: UserRole;
  permissions?: Permission[];
  isActive?: boolean;
  email?: string;
} = {}) {
  const role = opts.role ?? 'member';
  const user = await User.create({
    firstName: 'Test',
    lastName: 'User',
    email: opts.email ?? uniqueEmail('user'),
    password: 'TestPass123!',
    role,
    permissions: opts.permissions ?? roleDefaultPermissions(role),
    isActive: opts.isActive ?? true,
  });
  return user;
}

export function toActor(user: { _id: unknown; role: UserRole; permissions: Permission[] }): SessionUser {
  return {
    id: String(user._id),
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    role: user.role,
    permissions: user.permissions,
  };
}
