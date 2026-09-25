import 'server-only';
import mongoose from 'mongoose';
import Lead, { type LeadDocument } from '@/models/Lead';
import Client from '@/models/Client';
import { AppError, conflict } from '@/lib/api/errors';
import { escapeRegex, parsePagination } from '@/lib/api/query';
import { recordAudit } from '@/services/audit';
import { serializeClient } from '@/services/clients';
import { sendEmail, leadAssignedEmail } from '@/lib/email';
import { isAdmin } from '@/lib/permissions';
import type { SessionUser } from '@/lib/auth/session';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStageInput,
  AddLeadActivityInput,
  LeadListQuery,
} from '@/lib/validation/lead';

const NAME_COLLATION = { locale: 'en', strength: 2 } as const;

export function serializeLead(lead: LeadDocument) {
  const obj = lead.toObject({ virtuals: true });
  return {
    id: String(obj._id),
    firstName: obj.firstName,
    lastName: obj.lastName,
    fullName: obj.fullName,
    email: obj.email,
    phone: obj.phone,
    jobTitle: obj.jobTitle,
    company: obj.company,
    companySize: obj.companySize,
    industry: obj.industry,
    website: obj.website,
    source: obj.source,
    sourceDetails: obj.sourceDetails,
    stage: obj.stage,
    stageHistory: obj.stageHistory,
    estimatedBudget: obj.estimatedBudget,
    expectedTimeline: obj.expectedTimeline,
    assignedTo: obj.assignedTo,
    requirements: obj.requirements,
    notes: obj.notes,
    tags: obj.tags,
    priority: obj.priority,
    isActive: obj.isActive,
    lostReason: obj.lostReason,
    wonDate: obj.wonDate,
    activities: (obj.activities ?? []).slice().reverse(),
    convertedToClient: obj.convertedToClient,
    convertedAt: obj.convertedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function isConverted(lead: LeadDocument): boolean {
  return Boolean(lead.convertedToClient);
}

function assertEditable(lead: LeadDocument) {
  if (isConverted(lead)) {
    throw new AppError(400, 'This lead has been converted to a client and can no longer be edited');
  }
}

export async function list(actor: SessionUser, query: LeadListQuery) {
  const { page, limit, skip } = parsePagination(new URLSearchParams({ page: String(query.page), limit: String(query.limit) }));
  const filter: Record<string, unknown> = { isActive: true };

  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { company: re }, { phone: re }];
  }
  if (query.stage) filter.stage = query.stage;
  if (query.source) filter.source = query.source;
  if (query.priority) filter.priority = query.priority;
  if (query.assignedTo === 'me') filter.assignedTo = actor.id;
  else if (query.assignedTo === 'unassigned') filter.assignedTo = null;
  else if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.createdFrom || query.createdTo) {
    filter.createdAt = {
      ...(query.createdFrom ? { $gte: new Date(query.createdFrom) } : {}),
      ...(query.createdTo ? { $lte: new Date(query.createdTo) } : {}),
    };
  }
  if (query.converted === 'true') filter.convertedToClient = { $ne: null };
  if (query.converted === 'false') filter.convertedToClient = null;

  const sortOrder = query.order === 'asc' ? 1 : -1;

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .sort({ [query.sort]: sortOrder })
      .skip(skip)
      .limit(limit),
    Lead.countDocuments(filter),
  ]);

  return { items: leads.map(serializeLead), total, page, limit };
}

export async function get(id: string, includeInactive = false) {
  const filter: Record<string, unknown> = { _id: id };
  if (!includeInactive) filter.isActive = true;

  const lead = await Lead.findOne(filter)
    .populate('assignedTo', 'firstName lastName email')
    .populate('activities.user', 'firstName lastName email')
    .populate('stageHistory.changedBy', 'firstName lastName email')
    .populate('convertedToClient', 'companyName');
  if (!lead) throw new AppError(404, 'Resource not found');
  return serializeLead(lead);
}

export async function create(actor: SessionUser, input: CreateLeadInput) {
  const assignedTo = isAdmin(actor) ? input.assignedTo ?? undefined : actor.id;

  const lead = new Lead({
    ...input,
    assignedTo,
    createdBy: actor.id,
    stageHistory: [{ stage: 'new', changedAt: new Date(), changedBy: actor.id }],
    activities: [{ type: 'note', description: 'Lead created', user: actor.id }],
  });
  await lead.save();

  await recordAudit({ user: actor.id, action: 'create', entity: 'lead', entityId: String(lead._id), description: `Created lead ${lead.fullName}` });

  if (lead.assignedTo && String(lead.assignedTo) !== actor.id) {
    void notifyAssignee(lead).catch((err) => console.error('lead assignment email failed', err));
  }

  return serializeLead(lead);
}

async function notifyAssignee(lead: LeadDocument): Promise<void> {
  const User = (await import('@/models/User')).default;
  const assignee = await User.findById(lead.assignedTo).select('firstName email');
  if (!assignee) return;
  const email = leadAssignedEmail({
    leadId: String(lead._id),
    leadFullName: lead.fullName,
    company: lead.company,
    assigneeEmail: assignee.email,
    assigneeFirstName: assignee.firstName,
  });
  await sendEmail(email);
}

export async function update(actor: SessionUser, id: string, input: UpdateLeadInput) {
  const lead = await Lead.findById(id);
  if (!lead || !lead.isActive) throw new AppError(404, 'Resource not found');
  assertEditable(lead);

  if (input.assignedTo !== undefined && !isAdmin(actor) && input.assignedTo !== actor.id) {
    throw new AppError(403, 'You can only assign leads to yourself');
  }

  const previousAssignee = lead.assignedTo ? String(lead.assignedTo) : undefined;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (lead as unknown as Record<string, unknown>)[key] = value;
  }

  const newAssignee = lead.assignedTo ? String(lead.assignedTo) : undefined;
  if (newAssignee !== previousAssignee) {
    const User = (await import('@/models/User')).default;
    const description = newAssignee
      ? `Lead assigned to ${(await User.findById(newAssignee).select('firstName lastName'))?.fullName ?? 'a user'}`
      : 'Lead unassigned';
    lead.activities.push({ type: 'assignment', description, user: actor.id } as never);
  }

  await lead.save();
  await recordAudit({ user: actor.id, action: 'update', entity: 'lead', entityId: id, description: `Updated lead ${lead.fullName}` });

  if (newAssignee && newAssignee !== previousAssignee && newAssignee !== actor.id) {
    void notifyAssignee(lead).catch((err) => console.error('lead assignment email failed', err));
  }

  return serializeLead(lead);
}

export async function changeStage(actor: SessionUser, id: string, input: UpdateLeadStageInput) {
  const lead = await Lead.findById(id);
  if (!lead || !lead.isActive) throw new AppError(404, 'Resource not found');
  assertEditable(lead);

  if (input.stage === lead.stage) return serializeLead(lead);

  if (input.stage === 'won') {
    const result = await convertToClient(actor, id);
    return result.lead;
  }

  const previousStage = lead.stage;
  lead.stage = input.stage;

  if (input.stage === 'lost') {
    lead.lostReason = input.lostReason;
  } else if (previousStage === 'lost') {
    lead.lostReason = undefined;
  }

  lead.stageHistory.push({ stage: input.stage, changedAt: new Date(), changedBy: actor.id } as never);
  lead.activities.push({
    type: 'status_change',
    description: `Stage changed from ${previousStage} to ${input.stage}`,
    user: actor.id,
    metadata: { previousStage, newStage: input.stage },
  } as never);

  await lead.save();
  await recordAudit({ user: actor.id, action: 'status_change', entity: 'lead', entityId: id, description: `Stage changed to ${input.stage}` });

  return serializeLead(lead);
}

export async function addActivity(actor: SessionUser, id: string, input: AddLeadActivityInput) {
  const lead = await Lead.findById(id);
  if (!lead || !lead.isActive) throw new AppError(404, 'Resource not found');

  lead.activities.push({ type: input.type, description: input.description, user: actor.id } as never);
  await lead.save();

  return serializeLead(lead);
}

export async function remove(actor: SessionUser, id: string): Promise<{ hardDeleted: boolean }> {
  const lead = await Lead.findById(id);
  if (!lead) throw new AppError(404, 'Resource not found');

  if (isConverted(lead)) {
    throw new AppError(409, "Converted leads can't be deleted; delete or archive the client instead");
  }

  const hardDelete = actor.role === 'superadmin';
  if (hardDelete) {
    await lead.deleteOne();
  } else {
    lead.isActive = false;
    await lead.save();
  }

  await recordAudit({
    user: actor.id,
    action: 'delete',
    entity: 'lead',
    entityId: id,
    description: `${hardDelete ? 'Deleted' : 'Archived'} lead ${lead.fullName}`,
  });

  return { hardDeleted: hardDelete };
}

export async function stats() {
  const filter = { isActive: true };
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [byStage, bySource, monthly, openPipeline, total, newThisMonth] = await Promise.all([
    Lead.aggregate([{ $match: filter }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: filter }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: { ...filter, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          created: { $sum: 1 },
          won: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Lead.aggregate([
      { $match: { ...filter, stage: { $nin: ['won', 'lost'] } } },
      {
        $group: {
          _id: '$estimatedBudget.currency',
          total: { $sum: '$estimatedBudget.max' },
        },
      },
    ]),
    Lead.countDocuments(filter),
    Lead.countDocuments({ ...filter, createdAt: { $gte: startOfMonth() } }),
  ]);

  return {
    byStage: Object.fromEntries(byStage.map((s) => [s._id, s.count])),
    bySource: Object.fromEntries(bySource.map((s) => [s._id, s.count])),
    monthly: monthly.map((m) => ({ year: m._id.year, month: m._id.month, created: m.created, won: m.won })),
    openPipelineByCurrency: Object.fromEntries(openPipeline.filter((p) => p._id).map((p) => [p._id, p.total])),
    total,
    newThisMonth,
  };
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface ConversionResult {
  client: ReturnType<typeof serializeClient>;
  lead: ReturnType<typeof serializeLead>;
  alreadyConverted: boolean;
}

export async function convertToClient(actor: SessionUser, leadId: string): Promise<ConversionResult> {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new AppError(404, 'Resource not found');

  const existing = await findExistingConversion(lead);
  if (existing) return existing;

  if (!lead.company || !lead.firstName || !lead.lastName || !lead.email) {
    throw new AppError(400, 'Company, first name, last name and email are required to convert this lead');
  }

  const notesParts: string[] = [];
  if (lead.requirements) notesParts.push(`Requirements:\n${lead.requirements}`);
  if (lead.notes) notesParts.push(lead.notes);
  if (lead.estimatedBudget?.min !== undefined || lead.estimatedBudget?.max !== undefined) {
    const currency = lead.estimatedBudget?.currency ?? 'USD';
    notesParts.push(`Estimated budget: ${lead.estimatedBudget?.min ?? '—'}–${lead.estimatedBudget?.max ?? '—'} ${currency}`);
  }

  const clientData = {
    companyName: lead.company.trim(),
    industry: lead.industry,
    companySize: lead.companySize,
    website: lead.website,
    contacts: [
      {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        jobTitle: lead.jobTitle,
        isPrimary: true,
      },
    ],
    source: 'lead_conversion' as const,
    convertedFromLead: lead._id,
    accountManager: lead.assignedTo,
    status: 'active' as const,
    currency: lead.estimatedBudget?.currency ?? 'USD',
    tags: lead.tags,
    notes: notesParts.length ? notesParts.join('\n\n') : undefined,
    createdBy: new mongoose.Types.ObjectId(actor.id),
  };

  try {
    const client = await runConversionTransaction(lead, clientData, actor.id);
    await recordAudit({ user: actor.id, action: 'update', entity: 'lead', entityId: String(lead._id), description: `Converted to client ${client.companyName}` });
    await recordAudit({ user: actor.id, action: 'create', entity: 'client', entityId: String(client._id), description: `Created from lead ${lead.fullName}` });
    return { client: serializeClient(client), lead: serializeLead(lead), alreadyConverted: false };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const field = Object.keys(err.keyValue ?? {})[0];
      if (field === 'convertedFromLead') {
        const raced = await Client.findOne({ convertedFromLead: lead._id });
        if (raced) {
          if (!lead.convertedToClient) {
            lead.convertedToClient = raced._id;
            lead.convertedAt = lead.convertedAt ?? new Date();
            await lead.save();
          }
          return { client: serializeClient(raced), lead: serializeLead(lead), alreadyConverted: true };
        }
      }
      if (field === 'companyName') {
        const dup = await Client.findOne({ companyName: clientData.companyName, isActive: true }).collation(NAME_COLLATION);
        throw conflict(`A client named "${clientData.companyName}" already exists. Rename the lead's company or open the existing client.`, {
          existingClientId: dup ? String(dup._id) : undefined,
        });
      }
    }
    throw err;
  }
}

async function findExistingConversion(lead: LeadDocument): Promise<ConversionResult | null> {
  if (lead.convertedToClient) {
    const client = await Client.findById(lead.convertedToClient);
    if (client) return { client: serializeClient(client), lead: serializeLead(lead), alreadyConverted: true };
  }
  const byLead = await Client.findOne({ convertedFromLead: lead._id });
  if (byLead) {
    if (!lead.convertedToClient) {
      lead.convertedToClient = byLead._id;
      lead.convertedAt = lead.convertedAt ?? new Date();
      lead.stage = 'won';
      await lead.save();
    }
    return { client: serializeClient(byLead), lead: serializeLead(lead), alreadyConverted: true };
  }
  return null;
}

async function runConversionTransaction(
  lead: LeadDocument,
  clientData: Record<string, unknown>,
  actorId: string
): Promise<InstanceType<typeof Client>> {
  const applyLeadChanges = (createdClient: InstanceType<typeof Client>) => {
    const previousStage = lead.stage;
    lead.stage = 'won';
    lead.wonDate = new Date();
    lead.convertedAt = new Date();
    lead.convertedToClient = createdClient._id;
    lead.stageHistory.push({ stage: 'won', changedAt: new Date(), changedBy: new mongoose.Types.ObjectId(actorId) } as never);
    lead.activities.push({
      type: 'status_change',
      description: `Converted to client ${createdClient.companyName}`,
      user: actorId,
      metadata: { previousStage, newStage: 'won' },
    } as never);
  };

  const session = await mongoose.startSession();
  try {
    let createdClient: InstanceType<typeof Client> | undefined;
    await session.withTransaction(async () => {
      const created = await Client.create([clientData], { session });
      createdClient = created[0];
      applyLeadChanges(createdClient);
      await lead.save({ session });
    });
    return createdClient as InstanceType<typeof Client>;
  } catch (err) {
    if (isTransactionsUnsupportedError(err)) {
      const created = await Client.create(clientData);
      applyLeadChanges(created);
      await lead.save();
      return created;
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

interface MongoDuplicateKeyError {
  code: number;
  keyValue?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 11000;
}

function isTransactionsUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /Transaction numbers are only allowed|replica set|IllegalOperation/i.test(message);
}
