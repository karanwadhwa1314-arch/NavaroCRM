import { USER_ROLES, type UserRole } from '@/lib/constants';

export const PERMISSIONS = [
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.delete',
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const LEADS_ALL: Permission[] = ['leads.view', 'leads.create', 'leads.edit', 'leads.delete'];
const CLIENTS_ALL: Permission[] = ['clients.view', 'clients.create', 'clients.edit', 'clients.delete'];
const USERS_ALL: Permission[] = ['users.view', 'users.create', 'users.edit', 'users.delete'];

/** superadmin permissions are inherent and are never stored on the user document. */
export const ROLE_DEFAULTS: Record<Exclude<UserRole, 'superadmin'>, Permission[]> = {
  admin: [...LEADS_ALL, ...CLIENTS_ALL],
  member: [...LEADS_ALL, ...CLIENTS_ALL],
};

export function roleDefaultPermissions(role: UserRole): Permission[] {
  if (role === 'superadmin') return [];
  return ROLE_DEFAULTS[role];
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'leads.view': 'View leads',
  'leads.create': 'Create leads',
  'leads.edit': 'Edit leads',
  'leads.delete': 'Delete leads',
  'clients.view': 'View clients',
  'clients.create': 'Create clients',
  'clients.edit': 'Edit clients',
  'clients.delete': 'Delete clients',
  'users.view': 'View users',
  'users.create': 'Create users',
  'users.edit': 'Edit users',
  'users.delete': 'Delete users',
};

export const PERMISSION_GROUPS: { group: string; perms: Permission[] }[] = [
  { group: 'Leads', perms: LEADS_ALL },
  { group: 'Clients', perms: CLIENTS_ALL },
  { group: 'Users', perms: USERS_ALL },
];

export interface PermissionCheckable {
  role: UserRole;
  permissions: Permission[];
}

export function hasPermission(user: PermissionCheckable, ...perms: Permission[]): boolean {
  if (user.role === 'superadmin') return true;
  return perms.some((p) => user.permissions.includes(p));
}

export function isAdmin(user: PermissionCheckable): boolean {
  return user.role === 'superadmin' || user.role === 'admin';
}

export { USER_ROLES };
