import { describe, it, expect } from 'vitest';
import { parseCsv, parseLeadCsv } from '@/lib/csv';
import * as leadsService from '@/services/leads';
import Lead from '@/models/Lead';
import { createTestUser, toActor } from './helpers';

describe('csv parsing', () => {
  it('handles quotes, escaped quotes, CRLF and embedded newlines', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n"multi\nline",z\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['multi\nline', 'z']]);
  });

  it('maps common header variations and ignores unknown columns', () => {
    const p = parseLeadCsv('First Name,last_name,E-mail,Phone Number,Favourite Colour\nAda,Lovelace,ADA@x.com,555,blue');
    expect(p.missingColumns).toEqual([]);
    expect(p.ignoredColumns).toEqual(['Favourite Colour']);
    expect(p.rows[0]).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', email: 'ADA@x.com', phone: '555' });
  });

  it('reports missing required columns', () => {
    expect(parseLeadCsv('First Name,Email\nA,a@x.com').missingColumns).toEqual(['Phone', expect.stringContaining('Company name')]);
    expect(parseLeadCsv('Company,Email\nAcme,a@x.com').missingColumns).toEqual(['Phone']);
    expect(parseLeadCsv('Contact Person,Email,Phone\nA B,a@x.com,1').missingColumns).toEqual([]);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('a,b\n"oops,1')).toThrow(/unclosed/i);
  });
});

describe('importLeads', () => {
  const good = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '555-0100' };

  it('dry run reports counts and persists nothing', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    const r = await leadsService.importLeads(actor, [good, { ...good, email: 'bad', phone: '' }], true);
    expect(r).toMatchObject({ total: 2, valid: 1, invalid: 1, imported: 0 });
    expect(await Lead.countDocuments()).toBe(0);
  });

  it('imports valid rows, skips invalid ones, and reports line numbers', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    const r = await leadsService.importLeads(actor, [good, { ...good, email: 'grace@example.com', lastName: '' }], false);
    expect(r.imported).toBe(1);
    expect(r.rows.find((x) => x.status === 'invalid')).toMatchObject({ line: 3 });
    const lead = await Lead.findOne({ email: 'ada@example.com' });
    expect(lead!.company).toBe('Ada Lovelace'); // fallback: model requires a company
    expect(lead!.stageHistory).toHaveLength(1);
  });

  it('skips duplicates of existing leads (case-insensitive) and repeats inside the file', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    await leadsService.importLeads(actor, [good], false);
    const r = await leadsService.importLeads(actor, [{ ...good, email: 'ADA@example.com' }, { ...good, email: 'new@example.com' }, { ...good, email: 'new@example.com' }], false);
    expect(r).toMatchObject({ imported: 1, duplicates: 2 });
    expect(await Lead.countDocuments()).toBe(2);
  });

  it('a soft-deleted lead does not block re-importing its email', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    await leadsService.importLeads(actor, [good], false);
    await Lead.updateMany({}, { isActive: false });
    expect((await leadsService.importLeads(actor, [good], false)).imported).toBe(1);
  });

  it('non-admins own what they import; admins start unassigned', async () => {
    const member = await createTestUser({ role: 'member' });
    const admin = await createTestUser({ role: 'admin' });
    await leadsService.importLeads(toActor(member), [good], false);
    await leadsService.importLeads(toActor(admin), [{ ...good, email: 'b@example.com' }], false);
    expect(String((await Lead.findOne({ email: 'ada@example.com' }))!.assignedTo)).toBe(String(member._id));
    expect((await Lead.findOne({ email: 'b@example.com' }))!.assignedTo).toBeUndefined();
  });

  it('maps a recognised source and falls back to other', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    await leadsService.importLeads(actor, [{ ...good, source: 'Cold Call' }, { ...good, email: 'z@example.com', source: 'billboard' }], false);
    expect((await Lead.findOne({ email: 'ada@example.com' }))!.source).toBe('cold_call');
    expect((await Lead.findOne({ email: 'z@example.com' }))!.source).toBe('other');
  });
});
