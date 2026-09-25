import { describe, it, expect } from 'vitest';
import { hasPermission, isAdmin, roleDefaultPermissions, ROLE_DEFAULTS } from '@/lib/permissions';

describe('permissions', () => {
  it('superadmin bypasses every permission check regardless of its permissions array', () => {
    const superadmin = { role: 'superadmin' as const, permissions: [] };
    expect(hasPermission(superadmin, 'users.delete')).toBe(true);
    expect(hasPermission(superadmin, 'leads.view', 'clients.view')).toBe(true);
  });

  it('is any-of semantics: passes if the user holds at least one of the listed permissions', () => {
    const user = { role: 'member' as const, permissions: ['leads.view' as const] };
    expect(hasPermission(user, 'leads.view', 'clients.view')).toBe(true);
    expect(hasPermission(user, 'clients.view', 'users.view')).toBe(false);
  });

  it('role defaults: admin and member both get leads.* and clients.* only', () => {
    expect(ROLE_DEFAULTS.admin.sort()).toEqual(
      ['leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'clients.view', 'clients.create', 'clients.edit', 'clients.delete'].sort()
    );
    expect(ROLE_DEFAULTS.member.sort()).toEqual(ROLE_DEFAULTS.admin.sort());
  });

  it('roleDefaultPermissions returns an empty array for superadmin (permissions are inherent, never stored)', () => {
    expect(roleDefaultPermissions('superadmin')).toEqual([]);
  });

  it('isAdmin is true for superadmin and admin, false for member', () => {
    expect(isAdmin({ role: 'superadmin', permissions: [] })).toBe(true);
    expect(isAdmin({ role: 'admin', permissions: [] })).toBe(true);
    expect(isAdmin({ role: 'member', permissions: [] })).toBe(false);
  });
});
