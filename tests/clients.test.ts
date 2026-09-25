import { describe, it, expect } from 'vitest';
import * as clientsService from '@/services/clients';
import Client from '@/models/Client';
import Lead from '@/models/Lead';
import { createTestUser, toActor } from './helpers';

describe('clients service', () => {
  it('a non-admin create is forced to be their own account manager', async () => {
    const member = await createTestUser({ role: 'member', permissions: ['clients.create'] });
    const otherUser = await createTestUser({ role: 'member' });

    const client = await clientsService.create(toActor(member), {
      companyName: 'Member Created Co',
      accountManager: String(otherUser._id),
    } as never);

    const accountManagerId =
      typeof client.accountManager === 'object' && client.accountManager !== null
        ? String((client.accountManager as { _id: unknown })._id)
        : String(client.accountManager);
    expect(accountManagerId).toBe(String(member._id));
  });

  it('a non-admin cannot reassign the account manager on update', async () => {
    const member = await createTestUser({ role: 'member', permissions: ['clients.create', 'clients.edit'] });
    const otherUser = await createTestUser({ role: 'member' });
    const client = await clientsService.create(toActor(member), { companyName: 'Reassign Test Co' } as never);

    await expect(
      clientsService.update(toActor(member), client.id, { accountManager: String(otherUser._id) } as never)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('a case-insensitive duplicate company name among active clients gives 409', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    await clientsService.create(toActor(superadmin), { companyName: 'Northwind Traders' } as never);

    await expect(
      clientsService.create(toActor(superadmin), { companyName: 'NORTHWIND TRADERS' } as never)
    ).rejects.toMatchObject({ status: 409 });
  });

  it("a soft-deleted client's name becomes reusable", async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const admin = await createTestUser({ role: 'admin' }); // non-superadmin → soft delete
    const client = await clientsService.create(toActor(superadmin), { companyName: 'Reusable Name Co' } as never);

    await clientsService.remove(toActor(admin), client.id);

    await expect(
      clientsService.create(toActor(superadmin), { companyName: 'Reusable Name Co' } as never)
    ).resolves.toBeDefined();
  });

  it('the primary-contact invariant holds after add, update and delete', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const client = await clientsService.create(toActor(superadmin), { companyName: 'Contact Invariant Co' } as never);

    const afterFirst = await clientsService.addContact(toActor(superadmin), client.id, {
      firstName: 'A',
      lastName: 'One',
      email: 'a@example.com',
      isPrimary: false,
    } as never);
    // No contact was primary, so the first contact added must become primary automatically.
    expect(afterFirst.contacts.filter((c: { isPrimary: boolean }) => c.isPrimary)).toHaveLength(1);

    const afterSecond = await clientsService.addContact(toActor(superadmin), client.id, {
      firstName: 'B',
      lastName: 'Two',
      email: 'b@example.com',
      isPrimary: true,
    } as never);
    const primaries = afterSecond.contacts.filter((c: { isPrimary: boolean }) => c.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].email).toBe('b@example.com');

    const primaryContact = afterSecond.contacts.find((c: { isPrimary: boolean }) => c.isPrimary)!;
    const afterDelete = await clientsService.removeContact(toActor(superadmin), client.id, primaryContact.id);
    expect(afterDelete.contacts.filter((c: { isPrimary: boolean }) => c.isPrimary)).toHaveLength(1);
  });

  it('hard delete unlinks the source lead so it becomes editable again', async () => {
    const superadmin = await createTestUser({ role: 'superadmin' });
    const leadsService = await import('@/services/leads');
    const lead = await leadsService.create(toActor(superadmin), {
      firstName: 'Chidi',
      lastName: 'Eze',
      email: 'chidi.eze@example.com',
      company: 'Eze Logistics',
    } as never);
    const { client } = await leadsService.convertToClient(toActor(superadmin), lead.id);

    await clientsService.remove(toActor(superadmin), client.id); // superadmin → hard delete

    const reloadedLead = await Lead.findById(lead.id);
    expect(reloadedLead!.convertedToClient).toBeUndefined();
    expect(await Client.findById(client.id)).toBeNull();

    // The lead is editable again now that it's no longer linked to a client.
    await expect(leadsService.update(toActor(superadmin), lead.id, { notes: 'now editable' } as never)).resolves.toBeDefined();
  });
});
