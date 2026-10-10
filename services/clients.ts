import mongoose from 'mongoose';
import Client, { type ClientDocument } from '@/models/Client';
import Lead from '@/models/Lead';
import Project from '@/models/Project';
import { AppError, conflict } from '@/lib/api/errors';
import { escapeRegex, parsePagination } from '@/lib/api/query';
import { recordAudit } from '@/services/audit';
import { isAdmin } from '@/lib/permissions';
import type { SessionUser } from '@/lib/auth/session';
import type { CreateClientInput, UpdateClientInput, ClientListQuery, ClientContactInput } from '@/lib/validation/client';

const NAME_COLLATION = { locale: 'en', strength: 2 } as const;

export function serializeClient(client: ClientDocument) {
  const obj = client.toObject({ virtuals: true });
  return {
    id: String(obj._id),
    companyName: obj.companyName,
    displayName: obj.displayName,
    industry: obj.industry,
    companySize: obj.companySize,
    website: obj.website,
    address: obj.address,
    billingAddress: obj.billingAddress,
    contacts: (obj.contacts ?? []).map((c: ClientDocument['contacts'][number]) => ({ ...c, id: String(c._id), _id: undefined })),
    primaryContact: obj.primaryContact ? { ...obj.primaryContact, id: String(obj.primaryContact._id), _id: undefined } : undefined,
    accountManager: obj.accountManager,
    status: obj.status,
    tier: obj.tier,
    paymentTerms: obj.paymentTerms,
    taxId: obj.taxId,
    currency: obj.currency,
    source: obj.source,
    convertedFromLead: obj.convertedFromLead,
    notes: obj.notes,
    tags: obj.tags,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function enforcePrimaryInvariant(client: ClientDocument) {
  if (client.contacts.length === 0) return;
  const primaryCount = client.contacts.filter((c) => c.isPrimary).length;
  if (primaryCount === 0) {
    client.contacts[0].isPrimary = true;
  } else if (primaryCount > 1) {
    let seen = false;
    for (const c of client.contacts) {
      if (c.isPrimary) {
        if (seen) c.isPrimary = false;
        seen = true;
      }
    }
  }
}

export async function list(actor: SessionUser, query: ClientListQuery) {
  const { page, limit, skip } = parsePagination(new URLSearchParams({ page: String(query.page), limit: String(query.limit) }));
  const filter: Record<string, unknown> = { isActive: true };

  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [
      { companyName: re },
      { displayName: re },
      { 'contacts.firstName': re },
      { 'contacts.lastName': re },
      { 'contacts.email': re },
    ];
  }
  if (query.status) filter.status = query.status;
  if (query.tier) filter.tier = query.tier;
  if (query.industry) filter.industry = new RegExp(escapeRegex(query.industry), 'i');
  if (query.accountManager) {
    filter.accountManager = query.accountManager === 'me' ? actor.id : query.accountManager;
  }

  const sortOrder = query.order === 'asc' ? 1 : -1;

  const [clients, total] = await Promise.all([
    Client.find(filter)
      .populate('accountManager', 'firstName lastName email')
      .sort({ [query.sort]: sortOrder })
      .skip(skip)
      .limit(limit),
    Client.countDocuments(filter),
  ]);

  return { items: clients.map(serializeClient), total, page, limit };
}

export async function get(id: string) {
  const client = await Client.findOne({ _id: id })
    .populate('accountManager', 'firstName lastName email')
    .populate('convertedFromLead', 'firstName lastName company');
  if (!client || !client.isActive) throw new AppError(404, 'Resource not found');
  return serializeClient(client);
}

export async function create(actor: SessionUser, input: CreateClientInput) {
  const accountManager = isAdmin(actor) ? input.accountManager ?? undefined : actor.id;

  const contacts = input.contact?.firstName
    ? [
        {
          firstName: input.contact.firstName,
          lastName: input.contact.lastName,
          email: input.contact.email,
          phone: input.contact.phone,
          jobTitle: input.contact.jobTitle,
          isPrimary: true,
        },
      ]
    : [];

  try {
    const client = await Client.create({
      companyName: input.companyName,
      displayName: input.displayName,
      industry: input.industry,
      companySize: input.companySize,
      website: input.website,
      address: input.address,
      billingAddress: input.billingAddress,
      contacts,
      accountManager,
      status: input.status,
      tier: input.tier,
      paymentTerms: input.paymentTerms,
      taxId: input.taxId,
      currency: input.currency,
      source: input.source ?? 'direct',
      notes: input.notes,
      tags: input.tags,
      createdBy: actor.id,
    });

    await recordAudit({ user: actor.id, action: 'create', entity: 'client', entityId: String(client._id), description: `Created client ${client.companyName}` });

    return serializeClient(client);
  } catch (err) {
    throw await mapDuplicateName(err, input.companyName);
  }
}

async function mapDuplicateName(err: unknown, companyName: string): Promise<AppError> {
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 11000) {
    const existing = await Client.findOne({ companyName, isActive: true }).collation(NAME_COLLATION);
    return conflict(`A client named "${companyName}" already exists. Rename it or open the existing client.`, {
      existingClientId: existing ? String(existing._id) : undefined,
    });
  }
  return err instanceof AppError ? err : new AppError(500, 'Something went wrong');
}

export async function update(actor: SessionUser, id: string, input: UpdateClientInput) {
  const client = await Client.findById(id);
  if (!client || !client.isActive) throw new AppError(404, 'Resource not found');

  if (input.accountManager !== undefined) {
    if (!isAdmin(actor) && input.accountManager !== actor.id) {
      throw new AppError(403, 'You cannot reassign the account manager');
    }
    client.accountManager = input.accountManager ? new mongoose.Types.ObjectId(input.accountManager) : undefined;
  }

  if (input.companyName !== undefined) client.companyName = input.companyName;
  if (input.displayName !== undefined) client.displayName = input.displayName;
  if (input.industry !== undefined) client.industry = input.industry;
  if (input.companySize !== undefined) client.companySize = input.companySize;
  if (input.website !== undefined) client.website = input.website;
  if (input.address !== undefined) client.address = input.address;
  if (input.status !== undefined) client.status = input.status;
  if (input.tier !== undefined) client.tier = input.tier;
  if (input.paymentTerms !== undefined) client.paymentTerms = input.paymentTerms;
  if (input.taxId !== undefined) client.taxId = input.taxId;
  if (input.currency !== undefined) client.currency = input.currency;
  if (input.source !== undefined) client.source = input.source;
  if (input.notes !== undefined) client.notes = input.notes;
  if (input.tags !== undefined) client.tags = input.tags;

  if (input.billingAddress !== undefined) {
    if (input.billingAddress.sameAsAddress) {
      client.billingAddress = { ...client.address, sameAsAddress: true };
    } else {
      client.billingAddress = input.billingAddress;
    }
  }

  try {
    await client.save();
  } catch (err) {
    throw await mapDuplicateName(err, client.companyName);
  }

  await recordAudit({ user: actor.id, action: 'update', entity: 'client', entityId: id, description: `Updated client ${client.companyName}` });

  return serializeClient(client);
}

export async function addContact(actor: SessionUser, clientId: string, input: ClientContactInput) {
  const client = await Client.findById(clientId);
  if (!client || !client.isActive) throw new AppError(404, 'Resource not found');

  if (input.isPrimary) {
    client.contacts.forEach((c) => (c.isPrimary = false));
  }
  client.contacts.push({ ...input, isPrimary: Boolean(input.isPrimary) } as ClientDocument['contacts'][number]);
  enforcePrimaryInvariant(client);
  await client.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'client', entityId: clientId, description: `Added contact to ${client.companyName}` });

  return serializeClient(client);
}

export async function updateContact(actor: SessionUser, clientId: string, contactId: string, input: Partial<ClientContactInput>) {
  const client = await Client.findById(clientId);
  if (!client || !client.isActive) throw new AppError(404, 'Resource not found');

  const contact = client.contacts.id(contactId);
  if (!contact) throw new AppError(404, 'Resource not found');

  if (input.isPrimary) {
    client.contacts.forEach((c) => (c.isPrimary = false));
  }
  Object.assign(contact, input);
  enforcePrimaryInvariant(client);
  await client.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'client', entityId: clientId, description: `Updated a contact on ${client.companyName}` });

  return serializeClient(client);
}

export async function removeContact(actor: SessionUser, clientId: string, contactId: string) {
  const client = await Client.findById(clientId);
  if (!client || !client.isActive) throw new AppError(404, 'Resource not found');

  const contact = client.contacts.id(contactId);
  if (!contact) throw new AppError(404, 'Resource not found');

  contact.deleteOne();
  enforcePrimaryInvariant(client);
  await client.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'client', entityId: clientId, description: `Removed a contact from ${client.companyName}` });

  return serializeClient(client);
}

export async function remove(actor: SessionUser, id: string): Promise<{ hardDeleted: boolean }> {
  const client = await Client.findById(id);
  if (!client) throw new AppError(404, 'Resource not found');

  const hardDelete = actor.role === 'superadmin';

  if (hardDelete) {
    // A project can't outlive its client: its name and code are built from the client's name.
    const projectCount = await Project.countDocuments({ client: client._id });
    if (projectCount > 0) {
      throw conflict(
        `${client.companyName} has ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}. Delete or archive ${projectCount === 1 ? 'it' : 'them'} first.`
      );
    }
    await client.deleteOne();
    if (client.convertedFromLead) {
      const lead = await Lead.findById(client.convertedFromLead);
      if (lead) {
        lead.convertedToClient = undefined;
        lead.activities.push({
          type: 'note',
          description: `Client ${client.companyName} was deleted`,
        } as never);
        await lead.save();
      }
    }
  } else {
    client.isActive = false;
    client.status = 'churned';
    await client.save();
  }

  await recordAudit({
    user: actor.id,
    action: 'delete',
    entity: 'client',
    entityId: id,
    description: `${hardDelete ? 'Deleted' : 'Archived'} client ${client.companyName}`,
  });

  return { hardDeleted: hardDelete };
}

export async function stats() {
  const filter = { isActive: true };
  const [byStatus, byTier, byIndustry, total, newThisMonth] = await Promise.all([
    Client.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Client.aggregate([{ $match: filter }, { $group: { _id: '$tier', count: { $sum: 1 } } }]),
    Client.aggregate([
      { $match: { ...filter, industry: { $nin: [null, ''] } } },
      { $group: { _id: '$industry', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Client.countDocuments(filter),
    Client.countDocuments({ ...filter, createdAt: { $gte: startOfMonth() } }),
  ]);

  return {
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    byTier: Object.fromEntries(byTier.map((s) => [s._id, s.count])),
    topIndustries: byIndustry.map((i) => ({ industry: i._id, count: i.count })),
    total,
    newThisMonth,
  };
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
