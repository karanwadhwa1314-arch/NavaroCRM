import { describe, it, expect } from 'vitest';
import { classifyRow, tidyPersonName } from '@/lib/lead-import';
import { MAX_IMPORT_ROWS, parseLeadCsv } from '@/lib/csv';
import { createLeadSchema, importLeadsBodySchema, leadListQuerySchema, updateLeadSchema } from '@/lib/validation/lead';
import * as leadsService from '@/services/leads';
import Lead from '@/models/Lead';
import Client from '@/models/Client';
import { createTestUser, toActor } from './helpers';

describe('classifyRow: person or company?', () => {
  it('splits a single "contact person" cell and tidies ALL-CAPS / all-lowercase names', () => {
    expect(classifyRow({ contactPerson: 'AMARDEEP MALHOTRA', company: '3 Birds Logistics' })).toMatchObject({ ok: true, type: 'individual', firstName: 'Amardeep', lastName: 'Malhotra', company: '3 Birds Logistics' });
    expect(classifyRow({ contactPerson: 'MR. A. MUKADAM', company: 'A P Cargo' })).toMatchObject({ firstName: 'A.', lastName: 'Mukadam' });
    expect(classifyRow({ contactPerson: 'Ravi', company: 'X Traders' })).toMatchObject({ type: 'individual', firstName: 'Ravi', lastName: '' }); // single word: first name only
    expect(tidyPersonName("o'brien")).toBe("O'Brien");
    expect(tidyPersonName('McDonald')).toBe('McDonald'); // mixed case is left alone
  });

  it('a company name with no person is a company lead', () => {
    expect(classifyRow({ company: 'Parle Biscuits Private Limited' })).toMatchObject({ ok: true, type: 'company', firstName: '', lastName: '', company: 'Parle Biscuits Private Limited' });
    expect(classifyRow({ company: 'Acme', contactPerson: '' })).toMatchObject({ type: 'company' });
  });

  it('a business-like contact cell means company; one that merely repeats a person-style name means a person', () => {
    expect(classifyRow({ contactPerson: 'A-STAR SHIPPING AND LOGISTICS LLP', company: 'A-STAR SHIPPING AND LOGISTICS LLP' })).toMatchObject({ type: 'company', company: 'A-STAR SHIPPING AND LOGISTICS LLP' });
    expect(classifyRow({ contactPerson: 'ASIF FAROOQUI', company: 'ASIF FAROOQUI' })).toMatchObject({ type: 'individual', firstName: 'Asif', lastName: 'Farooqui' }); // sole proprietor
  });

  it('keeps a differing business-like contact as a note instead of dropping it', () => {
    const r = classifyRow({ contactPerson: 'MADHU SHIPPING', company: 'RUSKIN CHEMIPHARM' });
    expect(r).toMatchObject({ ok: true, type: 'company', company: 'RUSKIN CHEMIPHARM', note: 'Contact: MADHU SHIPPING' });
  });

  it('explicit first/last columns win; a row needs a person or a company', () => {
    expect(classifyRow({ firstName: 'Ada', lastName: 'Lovelace' })).toMatchObject({ ok: true, type: 'individual', company: 'Ada Lovelace' });
    expect(classifyRow({ firstName: 'Ada' })).toMatchObject({ ok: false });
    expect(classifyRow({ firstName: 'Ada', company: 'Engines Ltd' })).toMatchObject({ ok: true, type: 'individual' });
    expect(classifyRow({})).toMatchObject({ ok: false });
  });
});

describe('CSV header mapping for company / contact-person files', () => {
  it('maps the real-world column names (Contact Person, Designation, Segment, Note)', () => {
    const p = parseLeadCsv('#,Company,Contact Person,Designation,Email,Phone,Location / Country,Segment,Note\n1,Acme Ltd,Jo Bloggs,Owner,jo@acme.com,+911,,Importer/Exporter,hi');
    expect(p.missingColumns).toEqual([]);
    expect(p.ignoredColumns).toEqual(['#', 'Location / Country']);
    expect(p.rows[0]).toMatchObject({ company: 'Acme Ltd', contactPerson: 'Jo Bloggs', jobTitle: 'Owner', email: 'jo@acme.com', segment: 'Importer/Exporter', notes: 'hi' });
  });
});

describe('importing companies and people together', () => {
  const base = { phone: '+911234567890' };

  it('imports people and company-only rows into one collection, marking the type', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    const rows = [
      { ...base, email: 'p1@acme.com', company: 'Acme Logistics', contactPerson: 'RAVI SHAH', jobTitle: 'Owner', segment: 'Forwarder/CHA/Logistics' },
      { ...base, email: 'c1@globex.com', company: 'GLOBEX EXPORTS PRIVATE LIMITED', contactPerson: '' },
      { ...base, email: 'c2@initech.com', company: 'Initech', contactPerson: 'INITECH PVT LTD', notes: 'staff email' },
      { ...base, email: 'nothing@x.com' },
    ];
    const dry = await leadsService.importLeads(actor, rows, true);
    expect(dry).toMatchObject({ total: 4, valid: 3, individuals: 1, companies: 2, invalid: 1, imported: 0 });
    expect(dry.rows).toHaveLength(1);
    expect(dry.rows[0]).toMatchObject({ line: 5, status: 'invalid' });
    expect(dry.samples.map((s) => s.type)).toEqual(['individual', 'company', 'company']);
    expect(await Lead.countDocuments()).toBe(0);

    const res = await leadsService.importLeads(actor, rows, false);
    expect(res.imported).toBe(3);
    const person = (await Lead.findOne({ email: 'p1@acme.com' }))!;
    expect(person).toMatchObject({ leadType: 'individual', firstName: 'Ravi', lastName: 'Shah', company: 'Acme Logistics', jobTitle: 'Owner' });
    expect(person.tags).toEqual(['Forwarder/CHA/Logistics']);
    const comp = (await Lead.findOne({ email: 'c1@globex.com' }))!;
    expect(comp.leadType).toBe('company');
    expect(comp.firstName).toBeUndefined();
    expect(comp.lastName).toBeUndefined();
    expect(comp.fullName).toBe('GLOBEX EXPORTS PRIVATE LIMITED');
    expect((await Lead.findOne({ email: 'c2@initech.com' }))!.notes).toBe('staff email');
  });

  it('accepts a company name over 120 characters', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    const long = 'SCAN SHIPPING LLC (Dubai) ' + 'x'.repeat(129);
    const r = await leadsService.importLeads(actor, [{ ...base, email: 'long@x.com', company: long }], false);
    expect(r.imported).toBe(1);
  });

  it('handles the 5,000-row limit: accepts 5,000, rejects 5,001, and imports them all', async () => {
    expect(MAX_IMPORT_ROWS).toBe(5000);
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `bulk${i}@example.com`, phone: '+911', company: `Company ${i}`, contactPerson: i % 5 === 0 ? '' : `Person${i} Surname` }));
    expect(importLeadsBodySchema.safeParse({ rows: mk(5000) }).success).toBe(true);
    expect(importLeadsBodySchema.safeParse({ rows: mk(5001) }).success).toBe(false);

    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    const started = Date.now();
    const r = await leadsService.importLeads(actor, mk(5000), false);
    expect(r).toMatchObject({ total: 5000, imported: 5000, individuals: 4000, companies: 1000, invalid: 0, duplicates: 0 });
    expect(await Lead.countDocuments()).toBe(5000);
    expect(Date.now() - started).toBeLessThan(30_000);
    // re-importing the same file adds nothing and reports only a capped list of the problems
    const again = await leadsService.importLeads(actor, mk(5000), true);
    expect(again.duplicates).toBe(5000);
    expect(again.rows.length).toBeLessThanOrEqual(500);
    expect(again.problemsTruncated).toBe(true);
  }, 60_000);
});

describe('lead types in the list', () => {
  async function seed() {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    await leadsService.create(actor, createLeadSchema.parse({ firstName: 'Ann', lastName: 'Lee', email: 'ann@x.com', company: 'Acme' }));
    await leadsService.create(actor, createLeadSchema.parse({ leadType: 'company', email: 'info@globex.com', company: 'Globex', firstName: 'ignored', lastName: 'ignored' }));
    // A lead saved before the leadType field existed has no value at all.
    await Lead.collection.insertOne({ firstName: 'Old', lastName: 'Timer', email: 'old@x.com', company: 'Legacy', isActive: true, stage: 'new', source: 'other', priority: 'medium', tags: [], stageHistory: [], activities: [], createdAt: new Date(), updatedAt: new Date() });
    return actor;
  }

  it('filters by type; leads without a type count as individuals', async () => {
    const actor = await seed();
    const q = (type?: string) => leadListQuerySchema.parse(type ? { type } : {});
    const individuals = await leadsService.list(actor, q('individual'));
    const companies = await leadsService.list(actor, q('company'));
    expect(individuals.items.map((l) => l.email).sort()).toEqual(['ann@x.com', 'old@x.com']);
    expect(companies.items.map((l) => l.email)).toEqual(['info@globex.com']);
    expect(companies.items[0]).toMatchObject({ leadType: 'company', fullName: 'Globex' });
    expect((await leadsService.list(actor, q())).total).toBe(2); // default view is individuals
    expect(leadListQuerySchema.parse({ type: 'bogus' }).type).toBe('individual');
    expect(await leadsService.typeCounts()).toEqual({ individual: 2, company: 1 });
    expect((await leadsService.stats('company')).total).toBe(1);
    expect((await leadsService.stats('individual')).total).toBe(2);
  });

  it('search finds company leads by company name', async () => {
    const actor = await seed();
    const r = await leadsService.list(actor, leadListQuerySchema.parse({ type: 'company', search: 'glob' }));
    expect(r.total).toBe(1);
  });
});

describe('creating and editing company leads', () => {
  it('a company lead needs only a company and email; an individual still needs both names', () => {
    expect(createLeadSchema.safeParse({ leadType: 'company', email: 'a@b.com', company: 'Acme' }).success).toBe(true);
    expect(createLeadSchema.safeParse({ email: 'a@b.com', company: 'Acme' }).success).toBe(false);
    expect(createLeadSchema.safeParse({ firstName: 'A', email: 'a@b.com', company: 'Acme' }).success).toBe(false);
    expect(createLeadSchema.safeParse({ leadType: 'company', email: 'a@b.com' }).success).toBe(false); // company name is still required
  });

  it('the type cannot be changed by an edit, and a company lead ignores person fields', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    const lead = await leadsService.create(actor, createLeadSchema.parse({ leadType: 'company', email: 'info@globex.com', company: 'Globex' }));
    expect(updateLeadSchema.safeParse({ leadType: 'individual' }).success).toBe(false);
    const updated = await leadsService.update(actor, lead.id, updateLeadSchema.parse({ company: 'Globex Corp', firstName: 'Sneaky' }));
    expect(updated).toMatchObject({ company: 'Globex Corp', leadType: 'company', fullName: 'Globex Corp' });
    expect(updated.firstName).toBeUndefined();
  });
});

describe('converting to a client', () => {
  it('a company lead becomes a client with no contact person; its email and phone are kept in the notes', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    const lead = await leadsService.create(actor, createLeadSchema.parse({ leadType: 'company', email: 'info@globex.com', phone: '+911', company: 'Globex' }));
    const { client } = await leadsService.convertToClient(actor, lead.id);
    expect(client.companyName).toBe('Globex');
    expect(client.contacts).toHaveLength(0);
    expect(client.notes).toContain('info@globex.com');
    expect((await Lead.findById(lead.id))!.stage).toBe('won');
  });

  it('an individual with only a first name converts to a contact without a last name', async () => {
    const actor = toActor(await createTestUser({ role: 'superadmin' }));
    await leadsService.importLeads(actor, [{ email: 'ravi@x.com', phone: '+911', company: 'X Traders', contactPerson: 'RAVI' }], false);
    const lead = (await Lead.findOne({ email: 'ravi@x.com' }))!;
    const { client } = await leadsService.convertToClient(actor, String(lead._id));
    expect(client.contacts[0]).toMatchObject({ firstName: 'Ravi', email: 'ravi@x.com' });
    expect(await Client.countDocuments()).toBe(1);
  });
});
