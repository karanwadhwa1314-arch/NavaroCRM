import { describe, it, expect } from 'vitest';
import * as usersService from '@/services/users';
import User from '@/models/User';
import Lead from '@/models/Lead';
import { AppError } from '@/lib/api/errors';
import { createTestUser, toActor } from './helpers';

describe('users service', () => {
  it('a member-creator cannot create an admin or superadmin', async () => {
    const creator = await createTestUser({ role: 'member', permissions: ['users.create'] });

    await expect(
      usersService.create(toActor(creator), {
        firstName: 'New',
        lastName: 'Admin',
        email: 'new.admin@example.com',
        password: 'Password123!',
        role: 'admin',
      })
    ).rejects.toThrow(/only a super admin/i);
  });

  it('create honours superadmin-chosen permissions instead of the role defaults', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });

    const created = await usersService.create(toActor(superadmin), {
      firstName: 'Custom',
      lastName: 'Perms',
      email: 'custom.perms@example.com',
      password: 'Password123!',
      role: 'member',
      permissions: ['leads.view'],
    });

    expect(created.permissions).toEqual(['leads.view']);
  });

  it('an admin cannot edit a superadmin', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const superadmin = await createTestUser({ role: 'superadmin' });

    await expect(usersService.update(toActor(admin), String(superadmin._id), { firstName: 'Hacked' })).rejects.toThrow(
      /only a super admin/i
    );
  });

  it('an admin cannot deactivate a superadmin', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const superadmin = await createTestUser({ role: 'superadmin' });

    await expect(usersService.setStatus(toActor(admin), String(superadmin._id), false)).rejects.toThrow(/only a super admin/i);
  });

  it('an admin cannot delete a superadmin', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const superadmin = await createTestUser({ role: 'superadmin' });

    await expect(usersService.remove(toActor(admin), String(superadmin._id))).rejects.toThrow(/cannot be deleted/i);
  });

  it('the last active superadmin cannot be demoted', async () => {
    const onlySuperadmin = await createTestUser({ role: 'superadmin' });

    await expect(usersService.changeRole(toActor(onlySuperadmin), String(onlySuperadmin._id), 'admin')).rejects.toThrow();
  });

  it('the last active superadmin cannot be deactivated', async () => {
    const superadminA = await createTestUser({ role: 'superadmin' });
    const actingSuperadmin = await createTestUser({ role: 'superadmin' });
    // Deactivate one, leaving exactly one active superadmin, then try to deactivate the last one.
    await usersService.setStatus(toActor(actingSuperadmin), String(superadminA._id), false);

    await expect(usersService.setStatus(toActor(superadminA), String(actingSuperadmin._id), false)).rejects.toThrow(
      /at least one active super admin/i
    );
  });

  it('a user cannot deactivate themselves', async () => {
    const self = await createTestUser({ role: 'admin' });
    await expect(usersService.setStatus(toActor(self), String(self._id), false)).rejects.toThrow(/cannot change your own status/i);
  });

  it('a user cannot delete themselves', async () => {
    const self = await createTestUser({ role: 'admin' });
    await expect(usersService.remove(toActor(self), String(self._id))).rejects.toThrow(/cannot delete your own account/i);
  });

  it('delete is blocked when the target owns active leads', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const owner = await createTestUser({ role: 'member' });
    await Lead.create({
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.com',
      company: 'Acme',
      assignedTo: owner._id,
      isActive: true,
    });

    await expect(usersService.remove(toActor(superadmin), String(owner._id))).rejects.toThrow(/reassign/i);
  });

  it('a role change resets permissions to the new role defaults', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const member = await createTestUser({ role: 'member', permissions: ['leads.view'] });

    const updated = await usersService.changeRole(toActor(superadmin), String(member._id), 'admin');
    expect(updated.permissions.sort()).toEqual(
      ['leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'clients.view', 'clients.create', 'clients.edit', 'clients.delete'].sort()
    );
  });

  it('a password change bumps tokenVersion', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const target = await createTestUser({ role: 'member' });
    const before = target.tokenVersion;

    await usersService.update(toActor(superadmin), String(target._id), { password: 'NewPassword123!' });

    const reloaded = await User.findById(target._id);
    expect(reloaded!.tokenVersion).toBe(before + 1);
  });

  it('setPermissions and resetPermissions refuse superadmin targets', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const otherSuperadmin = await createTestUser({ role: 'superadmin' });

    await expect(usersService.setPermissions(toActor(superadmin), String(otherSuperadmin._id), ['leads.view'])).rejects.toThrow(AppError);
    await expect(usersService.resetPermissions(toActor(superadmin), String(otherSuperadmin._id))).rejects.toThrow(AppError);
  });
});
