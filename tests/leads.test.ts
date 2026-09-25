import { describe, it, expect } from 'vitest';
import * as leadsService from '@/services/leads';
import Lead from '@/models/Lead';
import { createTestUser, toActor } from './helpers';

async function makeLead(overrides: Record<string, unknown> = {}) {
  return leadsService.create(toActor(await createTestUser({ role: 'superadmin' })), {
    firstName: 'Jordan',
    lastName: 'Lee',
    email: 'jordan.lee@example.com',
    company: 'Acme Trading',
    ...overrides,
  } as never);
}

describe('leads service', () => {
  it('a non-admin create is self-assigned regardless of what assignedTo is sent', async () => {
    const member = await createTestUser({ role: 'member', permissions: ['leads.create'] });
    const otherUser = await createTestUser({ role: 'member' });

    const lead = await leadsService.create(toActor(member), {
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.com',
      company: 'Acme',
      assignedTo: String(otherUser._id),
    } as never);

    expect(lead.assignedTo?._id ? String(lead.assignedTo._id) : lead.assignedTo).toBe(String(member._id));
  });

  it('a non-admin reassign gives 403', async () => {
    const member = await createTestUser({ role: 'member', permissions: ['leads.create', 'leads.edit'] });
    const otherUser = await createTestUser({ role: 'member' });
    const lead = await leadsService.create(toActor(member), {
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.com',
      company: 'Acme',
    } as never);

    await expect(
      leadsService.update(toActor(member), lead.id, { assignedTo: String(otherUser._id) } as never)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('exactly one stageHistory entry is added per stage change', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const lead = await makeLead();
    const before = (await Lead.findById(lead.id))!.stageHistory.length;

    await leadsService.changeStage(toActor(superadmin), lead.id, { stage: 'qualified' });

    const after = (await Lead.findById(lead.id))!.stageHistory.length;
    expect(after).toBe(before + 1);
  });

  it('marking a lead lost without a reason is rejected by validation before it reaches the service', async () => {
    const { updateLeadStageSchema } = await import('@/lib/validation/lead');
    const result = updateLeadStageSchema.safeParse({ stage: 'lost' });
    expect(result.success).toBe(false);
  });

  it('a converted lead is read-only', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const lead = await makeLead();
    await leadsService.convertToClient(toActor(superadmin), lead.id);

    await expect(leadsService.update(toActor(superadmin), lead.id, { notes: 'edited' } as never)).rejects.toThrow(/converted/i);
  });

  it('a converted lead cannot be deleted', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const lead = await makeLead();
    await leadsService.convertToClient(toActor(superadmin), lead.id);

    await expect(leadsService.remove(toActor(superadmin), lead.id)).rejects.toMatchObject({ status: 409 });
  });

  it('search escapes regex special characters instead of throwing', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    await makeLead({ company: 'Acme (Global) Trading' });

    await expect(
      leadsService.list(toActor(superadmin), {
        page: 1,
        limit: 20,
        search: 'a.*(',
        sort: 'createdAt',
        order: 'desc',
      } as never)
    ).resolves.toBeDefined();
  });

  it('stats groups open pipeline value by currency', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    await makeLead({ email: 'usd@example.com', estimatedBudget: { min: 1000, max: 2000, currency: 'USD' } });
    await makeLead({ email: 'eur@example.com', estimatedBudget: { min: 500, max: 1500, currency: 'EUR' } });

    const stats = await leadsService.stats();
    expect(stats.openPipelineByCurrency.USD).toBe(2000);
    expect(stats.openPipelineByCurrency.EUR).toBe(1500);
  });
});
