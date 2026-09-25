import 'server-only';
import User, { type UserDocument } from '@/models/User';
import Lead from '@/models/Lead';
import Client from '@/models/Client';
import { AppError } from '@/lib/api/errors';
import { escapeRegex, parsePagination } from '@/lib/api/query';
import { recordAudit } from '@/services/audit';
import { roleDefaultPermissions, type Permission } from '@/lib/permissions';
import type { UserRole } from '@/lib/constants';
import type { SessionUser } from '@/lib/auth/session';
import type { CreateUserInput, UpdateUserInput, UserListQuery } from '@/lib/validation/user';

function serialize(user: UserDocument) {
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    phone: user.phone,
    department: user.department,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function countActiveSuperadmins(excludeId?: string): Promise<number> {
  const filter: Record<string, unknown> = { role: 'superadmin', isActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  return User.countDocuments(filter);
}

export async function list(query: UserListQuery) {
  const { page, limit, skip } = parsePagination(new URLSearchParams({ page: String(query.page), limit: String(query.limit) }));
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
  }
  if (query.role) filter.role = query.role;
  if (query.isActive) filter.isActive = query.isActive === 'true';

  const sortField = query.sort;
  const sortOrder = query.order === 'asc' ? 1 : -1;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return { items: users.map((u) => serialize(u as unknown as UserDocument)), total, page, limit };
}

export async function assignable(search?: string) {
  const filter: Record<string, unknown> = { isActive: true };
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
  }
  const users = await User.find(filter).select('firstName lastName email role').limit(50).lean();
  return users.map((u) => ({ id: String(u._id), firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role }));
}

export async function get(id: string) {
  const user = await User.findById(id).lean();
  if (!user) throw new AppError(404, 'Resource not found');
  return serialize(user as unknown as UserDocument);
}

export async function create(actor: SessionUser, input: CreateUserInput) {
  const role: UserRole = input.role ?? 'member';

  if ((role === 'superadmin' || role === 'admin') && actor.role !== 'superadmin') {
    throw new AppError(403, 'Only a super admin may create a super admin or admin user');
  }

  const existing = await User.findOne({ email: input.email });
  if (existing) throw new AppError(409, 'A user with this email already exists');

  let permissions: Permission[];
  if (actor.role === 'superadmin' && input.permissions && role !== 'superadmin') {
    permissions = input.permissions;
  } else {
    permissions = roleDefaultPermissions(role);
  }

  const user = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: input.password,
    role,
    permissions,
    phone: input.phone,
    department: input.department,
    createdBy: actor.id,
  });

  await recordAudit({ user: actor.id, action: 'create', entity: 'user', entityId: String(user._id), description: `Created user ${user.email}` });

  return serialize(user);
}

export async function update(actor: SessionUser, id: string, input: UpdateUserInput) {
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'Resource not found');

  if (user.role === 'superadmin' && actor.role !== 'superadmin') {
    throw new AppError(403, 'Only a super admin may edit a super admin');
  }

  if (input.email && input.email !== user.email) {
    const existing = await User.findOne({ email: input.email, _id: { $ne: user._id } });
    if (existing) throw new AppError(409, 'A user with this email already exists');
    user.email = input.email;
  }
  if (input.firstName !== undefined) user.firstName = input.firstName;
  if (input.lastName !== undefined) user.lastName = input.lastName;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.department !== undefined) user.department = input.department;
  if (input.password) {
    user.password = input.password;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  }

  await user.save();
  await recordAudit({ user: actor.id, action: 'update', entity: 'user', entityId: id, description: `Updated user ${user.email}` });

  return serialize(user);
}

export async function changeRole(actor: SessionUser, id: string, role: UserRole) {
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'Resource not found');

  if (String(user._id) === actor.id && user.role === 'superadmin' && role !== 'superadmin') {
    throw new AppError(400, 'You cannot change your own super admin role');
  }
  if (user.role === 'superadmin' && role !== 'superadmin') {
    const remaining = await countActiveSuperadmins(String(user._id));
    if (remaining < 1) throw new AppError(400, 'At least one active super admin is required');
  }

  user.role = role;
  user.permissions = roleDefaultPermissions(role);
  await user.save();

  await recordAudit({
    user: actor.id,
    action: 'update',
    entity: 'user',
    entityId: id,
    description: `Changed role for ${user.email} to ${role}`,
  });

  return serialize(user);
}

export async function setPermissions(actor: SessionUser, id: string, permissions: Permission[]) {
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'Resource not found');
  if (user.role === 'superadmin') throw new AppError(400, 'Super admins have every permission and cannot be changed');

  user.permissions = permissions;
  await user.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'user', entityId: id, description: `Set permissions for ${user.email}` });

  return serialize(user);
}

export async function resetPermissions(actor: SessionUser, id: string) {
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'Resource not found');
  if (user.role === 'superadmin') throw new AppError(400, 'Super admins have every permission and cannot be changed');

  user.permissions = roleDefaultPermissions(user.role);
  await user.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'user', entityId: id, description: `Reset permissions for ${user.email} to role defaults` });

  return serialize(user);
}

export async function setStatus(actor: SessionUser, id: string, isActive: boolean) {
  if (id === actor.id) throw new AppError(400, 'You cannot change your own status');

  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'Resource not found');

  if (user.role === 'superadmin' && actor.role !== 'superadmin') {
    throw new AppError(403, 'Only a super admin may change a super admin');
  }

  if (user.role === 'superadmin' && !isActive) {
    const remaining = await countActiveSuperadmins(String(user._id));
    if (remaining < 1) throw new AppError(400, 'At least one active super admin is required');
  }

  user.isActive = isActive;
  if (!isActive) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  await recordAudit({
    user: actor.id,
    action: 'status_change',
    entity: 'user',
    entityId: id,
    description: `${isActive ? 'Activated' : 'Deactivated'} ${user.email}`,
  });

  return serialize(user);
}

export async function remove(actor: SessionUser, id: string): Promise<void> {
  if (id === actor.id) throw new AppError(400, 'You cannot delete your own account');

  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'Resource not found');
  if (user.role === 'superadmin') throw new AppError(400, 'Super admin accounts cannot be deleted');

  const [leadCount, clientCount] = await Promise.all([
    Lead.countDocuments({ assignedTo: user._id, isActive: true }),
    Client.countDocuments({ accountManager: user._id, isActive: true }),
  ]);

  if (leadCount > 0 || clientCount > 0) {
    throw new AppError(
      409,
      `Reassign this user's ${leadCount} lead${leadCount === 1 ? '' : 's'} and ${clientCount} client${clientCount === 1 ? '' : 's'}, or deactivate them instead.`
    );
  }

  await user.deleteOne();
  await recordAudit({ user: actor.id, action: 'delete', entity: 'user', entityId: id, description: `Deleted user ${user.email}` });
}
