import { describe, it, expect } from 'vitest';
import * as authService from '@/services/auth';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';
import { createTestUser } from './helpers';

describe('auth service', () => {
  it('a correct login succeeds, updates lastLogin and writes an audit login row', async () => {
    await createTestUser({ email: 'login.ok@example.com' });

    const result = await authService.login('login.ok@example.com', 'TestPass123!');
    expect(result.user.email).toBe('login.ok@example.com');

    const reloaded = await User.findOne({ email: 'login.ok@example.com' });
    expect(reloaded!.lastLogin).toBeInstanceOf(Date);

    const auditRow = await AuditLog.findOne({ action: 'login', user: reloaded!._id });
    expect(auditRow).not.toBeNull();
  });

  it('a wrong password gives 401 and writes a failed_login audit row', async () => {
    await createTestUser({ email: 'wrong.pw@example.com' });

    await expect(authService.login('wrong.pw@example.com', 'NotThePassword')).rejects.toMatchObject({ status: 401 });

    const auditRow = await AuditLog.findOne({ action: 'failed_login', 'metadata.email': 'wrong.pw@example.com' });
    expect(auditRow).not.toBeNull();
  });

  it('an unknown email also gives 401 (never reveals whether the account exists)', async () => {
    await expect(authService.login('nobody@example.com', 'whatever')).rejects.toMatchObject({ status: 401 });
  });

  it('a deactivated user gets 401', async () => {
    await createTestUser({ email: 'inactive@example.com', isActive: false });

    await expect(authService.login('inactive@example.com', 'TestPass123!')).rejects.toThrow(/deactivated/i);
  });

  it('the 11th failed attempt within an hour is throttled with 429', async () => {
    await createTestUser({ email: 'throttled@example.com' });

    for (let i = 0; i < 10; i++) {
      await expect(authService.login('throttled@example.com', 'wrong')).rejects.toMatchObject({ status: 401 });
    }

    await expect(authService.login('throttled@example.com', 'wrong')).rejects.toMatchObject({ status: 429 });
  });

  it('updatePassword bumps tokenVersion so existing sessions are invalidated', async () => {
    const user = await createTestUser({ email: 'changepw@example.com' });

    const result = await authService.updatePassword(String(user._id), 'TestPass123!', 'BrandNewPass123!');
    expect(result.tokenVersion).toBe(user.tokenVersion + 1);

    // the new password now works, the old one no longer does
    await expect(authService.login('changepw@example.com', 'BrandNewPass123!')).resolves.toBeDefined();
    await expect(authService.login('changepw@example.com', 'TestPass123!')).rejects.toMatchObject({ status: 401 });
  });

  it('updatePassword rejects an incorrect current password', async () => {
    const user = await createTestUser({ email: 'wrongcurrent@example.com' });
    await expect(authService.updatePassword(String(user._id), 'NotItAtAll', 'NewPassword123!')).rejects.toMatchObject({ status: 401 });
  });
});
