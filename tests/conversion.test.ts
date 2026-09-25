import { describe, it, expect } from 'vitest';
import * as leadsService from '@/services/leads';
import Lead from '@/models/Lead';
import Client from '@/models/Client';
import { createTestUser, toActor } from './helpers';

describe('lead → client conversion', () => {
  it('happy path: the lead is retained, marked won, and linked both ways to the new client', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const lead = await leadsService.create(toActor(superadmin), {
      firstName: 'Nora',
      lastName: 'Kim',
      email: 'nora.kim@example.com',
      company: 'Kim Exports',
    } as never);

    const result = await leadsService.convertToClient(toActor(superadmin), lead.id);

    expect(result.alreadyConverted).toBe(false);
    expect(result.client.companyName).toBe('Kim Exports');

    const reloadedLead = await Lead.findById(lead.id);
    expect(reloadedLead!.stage).toBe('won');
    expect(reloadedLead!.isActive).toBe(true);
    expect(String(reloadedLead!.convertedToClient)).toBe(result.client.id);

    const client = await Client.findById(result.client.id);
    expect(String(client!.convertedFromLead)).toBe(lead.id);
  });

  it('a second conversion call is idempotent and returns the same client', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const lead = await leadsService.create(toActor(superadmin), {
      firstName: 'Omar',
      lastName: 'Diallo',
      email: 'omar.diallo@example.com',
      company: 'Diallo Freight',
    } as never);

    const first = await leadsService.convertToClient(toActor(superadmin), lead.id);
    const second = await leadsService.convertToClient(toActor(superadmin), lead.id);

    expect(second.alreadyConverted).toBe(true);
    expect(second.client.id).toBe(first.client.id);
    expect(await Client.countDocuments({ convertedFromLead: lead.id })).toBe(1);
  });

  it('a duplicate company name gives 409 with existingClientId', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    await Client.create({ companyName: 'Existing Co', isActive: true, contacts: [], source: 'direct' });

    const lead = await leadsService.create(toActor(superadmin), {
      firstName: 'Priya',
      lastName: 'Nair',
      email: 'priya.nair@example.com',
      company: 'Existing Co',
    } as never);

    await expect(leadsService.convertToClient(toActor(superadmin), lead.id)).rejects.toMatchObject({
      status: 409,
      extra: expect.objectContaining({ existingClientId: expect.any(String) }),
    });
  });

  it('a missing email on the lead gives 400 instead of creating a client', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const lead = new Lead({
      firstName: 'Sam',
      lastName: 'Okafor',
      email: 'placeholder@example.com',
      company: 'Okafor Traders',
    });
    await lead.save();
    // Bypass schema validation to simulate a legacy/partial record missing its email.
    await Lead.updateOne({ _id: lead._id }, { $unset: { email: '' } });

    await expect(leadsService.convertToClient(toActor(superadmin), String(lead._id))).rejects.toMatchObject({ status: 400 });
  });

  it('a concurrent double-convert creates exactly one client', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const lead = await leadsService.create(toActor(superadmin), {
      firstName: 'Yusuf',
      lastName: 'Bello',
      email: 'yusuf.bello@example.com',
      company: 'Bello Commodities',
    } as never);

    const [a, b] = await Promise.allSettled([
      leadsService.convertToClient(toActor(superadmin), lead.id),
      leadsService.convertToClient(toActor(superadmin), lead.id),
    ]);

    const succeeded = [a, b].filter((r) => r.status === 'fulfilled');
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    expect(await Client.countDocuments({ convertedFromLead: lead.id })).toBe(1);
  });
});
