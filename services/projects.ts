import mongoose from 'mongoose';
import Project, { type ProjectDocument, type ProjectTeamMember } from '@/models/Project';
import ProjectCard from '@/models/ProjectCard';
import Client from '@/models/Client';
import User from '@/models/User';
import { AppError, conflict } from '@/lib/api/errors';
import { escapeRegex, parsePagination } from '@/lib/api/query';
import { recordAudit } from '@/services/audit';
import { isAdmin } from '@/lib/permissions';
import { calculateDeadlineHealth, emptyHealthSummary, getHealthLevel } from '@/lib/project-health';
import { buildProjectNaming, codeSequence, formatProjectCode } from '@/lib/project-naming';
import {
  PROJECT_LIVE_STATUSES,
  PROJECT_STATUS_LABELS,
  type CardStatus,
  type ProjectHealthLevel,
  type ProjectStatus,
} from '@/lib/constants';
import type { SessionUser } from '@/lib/auth/session';
import type {
  AddTeamMemberInput,
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
  UpdateTeamMemberInput,
} from '@/lib/validation/project';

const NAME_COLLATION = { locale: 'en', strength: 2 } as const;
const MAX_CODE_ATTEMPTS = 5;

export const READ_ONLY_MESSAGE = 'This project has ended and is read-only. Restart it before making changes.';

interface UserRef {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
}

/** Works for a populated user, an unpopulated ObjectId (→ null) and a deleted user (→ null). */
export function userRef(u: unknown): UserRef | null {
  if (!u || typeof u !== 'object' || !('firstName' in u)) return null;
  const doc = u as { _id: unknown; firstName: string; lastName: string; email?: string; role?: string };
  return { id: String(doc._id), firstName: doc.firstName, lastName: doc.lastName, email: doc.email, role: doc.role };
}

function idOf(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && '_id' in (value as object)) return String((value as { _id: unknown })._id);
  return String(value);
}

export interface CardCounts {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

interface HealthCardRow {
  project: mongoose.Types.ObjectId;
  status: CardStatus;
  deadline?: Date | null;
}

/** One query for the cards of many projects, grouped by project id. */
async function loadCardsFor(projectIds: unknown[]): Promise<Map<string, HealthCardRow[]>> {
  const cards = await ProjectCard.find({ project: { $in: projectIds } })
    .select('project status deadline')
    .lean<HealthCardRow[]>();
  const byProject = new Map<string, HealthCardRow[]>();
  for (const card of cards) {
    const key = String(card.project);
    const list = byProject.get(key);
    if (list) list.push(card);
    else byProject.set(key, [card]);
  }
  return byProject;
}

function countCards(cards: HealthCardRow[]): CardCounts {
  const counts: CardCounts = { todo: 0, in_progress: 0, done: 0, total: cards.length };
  for (const c of cards) counts[c.status] += 1;
  return counts;
}

export function serializeProject(project: ProjectDocument) {
  const obj = project.toObject();
  const client = obj.client as unknown as { _id: unknown; companyName?: string } | null;
  return {
    id: String(obj._id),
    name: obj.name,
    code: obj.code,
    description: obj.description,
    client: client && typeof client === 'object' && 'companyName' in client ? { id: String(client._id), companyName: client.companyName ?? '' } : null,
    clientId: idOf(obj.client),
    status: obj.status,
    priority: obj.priority,
    startDate: obj.startDate,
    actualEndDate: obj.actualEndDate,
    projectManager: userRef(obj.projectManager),
    team: (obj.team ?? []).map((m: ProjectTeamMember) => ({
      id: String(m._id),
      role: m.role,
      addedAt: m.addedAt,
      user: userRef(m.user),
    })),
    activities: [...(obj.activities ?? [])]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 50)
      .map((a) => ({
        id: String(a._id),
        type: a.type,
        description: a.description,
        user: userRef(a.user),
        createdAt: a.createdAt,
      })),
    tags: obj.tags ?? [],
    notes: obj.notes,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

type SerializedProject = ReturnType<typeof serializeProject>;

function withHealth(project: SerializedProject, cards: HealthCardRow[]) {
  const deadlineHealth = calculateDeadlineHealth(cards);
  return { ...project, deadlineHealth, healthLevel: getHealthLevel(deadlineHealth), cardCounts: countCards(cards) };
}

function populateForDetail<T extends mongoose.Query<unknown, unknown>>(query: T): T {
  return query
    .populate('client', 'companyName')
    .populate('projectManager', 'firstName lastName email')
    .populate('team.user', 'firstName lastName email role')
    .populate('activities.user', 'firstName lastName') as T;
}

function populateForList<T extends mongoose.Query<unknown, unknown>>(query: T): T {
  return query.populate('client', 'companyName').populate('projectManager', 'firstName lastName') as T;
}

export async function list(actor: SessionUser, query: ProjectListQuery) {
  const { page, limit, skip } = parsePagination(new URLSearchParams({ page: String(query.page), limit: String(query.limit) }));

  const clauses: Record<string, unknown>[] = [{ isActive: true }];
  if (query.status) clauses.push({ status: query.status });
  if (query.priority) clauses.push({ priority: query.priority });
  if (query.client) clauses.push({ client: query.client });
  if (query.projectManager) {
    clauses.push({ projectManager: query.projectManager === 'me' ? actor.id : query.projectManager });
  }
  if (query.teamMember) {
    const id = query.teamMember === 'me' ? actor.id : query.teamMember;
    if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Validation failed', { errors: [{ field: 'teamMember', message: 'Invalid id' }] });
    // "Involved in" = project manager or on the team: both can be given cards.
    clauses.push({ $or: [{ projectManager: id }, { 'team.user': id }] });
  }
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), 'i');
    clauses.push({ $or: [{ name: re }, { code: re }, { description: re }] });
  }
  const filter = { $and: clauses };

  const total = await Project.countDocuments(filter);

  if (query.sort) {
    const sortOrder = query.order === 'asc' ? 1 : -1;
    const projects = await populateForList(
      Project.find(filter)
        .sort({ [query.sort]: sortOrder, _id: sortOrder })
        .skip(skip)
        .limit(limit)
    );
    const cardsByProject = await loadCardsFor(projects.map((p) => p._id));
    return {
      items: projects.map((p) => withHealth(serializeProject(p), cardsByProject.get(String(p._id)) ?? [])),
      total,
      page,
      limit,
    };
  }

  // Default order: least healthy first. Health is derived from cards, so it can't be sorted in the database;
  // load every match (one cheap query for projects, one for their cards), sort, then slice the page.
  const projects = await populateForList(Project.find(filter).sort({ createdAt: -1, _id: -1 }));
  const cardsByProject = await loadCardsFor(projects.map((p) => p._id));
  const all = projects.map((p) => withHealth(serializeProject(p), cardsByProject.get(String(p._id)) ?? []));
  all.sort((a, b) => a.deadlineHealth - b.deadlineHealth);
  return { items: all.slice(skip, skip + limit), total, page, limit };
}

export async function stats() {
  const [byStatusRows, live] = await Promise.all([
    Project.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Project.find({ isActive: true, status: { $in: PROJECT_LIVE_STATUSES } }).select('_id').lean(),
  ]);

  const cardsByProject = await loadCardsFor(live.map((p) => p._id));
  const health: Record<ProjectHealthLevel, number> = emptyHealthSummary();
  for (const p of live) {
    health[getHealthLevel(calculateDeadlineHealth(cardsByProject.get(String(p._id)) ?? []))] += 1;
  }

  const byStatus = Object.fromEntries(byStatusRows.map((r) => [r._id, r.count])) as Partial<Record<ProjectStatus, number>>;
  const total = Object.values(byStatus).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  return { total, byStatus, health };
}

export async function get(id: string) {
  const project = await populateForDetail(Project.findById(id));
  if (!project || !project.isActive) throw new AppError(404, 'Resource not found');
  const cardsByProject = await loadCardsFor([project._id]);
  return withHealth(serializeProject(project), cardsByProject.get(String(project._id)) ?? []);
}

async function assertActiveUser(userId: string, field: string): Promise<void> {
  const user = await User.findById(userId).select('isActive').lean();
  if (!user || !user.isActive) {
    throw new AppError(400, 'Validation failed', { errors: [{ field, message: 'Select an active user' }] });
  }
}

async function nextCodeSequence(prefix: string): Promise<number> {
  const existing = await Project.find({ code: new RegExp(`^${escapeRegex(prefix)}-\\d+$`, 'i') })
    .select('code')
    .lean();
  return existing.reduce((max, p) => Math.max(max, codeSequence(p.code)), 0) + 1;
}

async function assertNameFree(name: string, excludeId?: string): Promise<void> {
  const filter: Record<string, unknown> = { name, isActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Project.findOne(filter).collation(NAME_COLLATION).select('_id').lean();
  if (existing) {
    throw conflict(`A project named "${name}" already exists. Use a different motive.`, { existingProjectId: String(existing._id) });
  }
}

function isDuplicateKey(err: unknown): err is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

export async function create(actor: SessionUser, input: CreateProjectInput) {
  const client = await Client.findOne({ _id: input.client, isActive: true }).select('companyName');
  if (!client) throw new AppError(400, 'Validation failed', { errors: [{ field: 'client', message: 'Client not found' }] });

  const naming = buildProjectNaming(client.companyName, input.motive);
  if (!naming.ok) throw new AppError(400, 'Validation failed', { errors: [{ field: naming.field, message: naming.error }] });

  // Non-admins always own what they create; only admins may name another project manager.
  const projectManager = isAdmin(actor) ? input.projectManager ?? undefined : actor.id;
  if (projectManager && projectManager !== actor.id) await assertActiveUser(projectManager, 'projectManager');

  await assertNameFree(naming.name);

  // The running number is read-then-written, so two creators can race for the same code; the unique index
  // on `code` settles it and the loser simply takes the next number.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = formatProjectCode(naming.codePrefix, await nextCodeSequence(naming.codePrefix));
    try {
      const project = await Project.create({
        name: naming.name,
        code,
        description: input.description,
        client: client._id,
        priority: input.priority,
        startDate: input.startDate,
        projectManager,
        tags: input.tags,
        notes: input.notes,
        createdBy: actor.id,
        activities: [{ type: 'created', description: 'Project created', user: actor.id }],
      });

      await recordAudit({ user: actor.id, action: 'create', entity: 'project', entityId: String(project._id), description: `Created project ${project.name} (${project.code})` });
      return get(String(project._id));
    } catch (err) {
      if (isDuplicateKey(err)) {
        if (err.keyPattern && 'name' in err.keyPattern) {
          throw conflict(`A project named "${naming.name}" already exists. Use a different motive.`);
        }
        continue; // code collision, try the next number
      }
      throw err;
    }
  }
  throw new AppError(409, 'Could not allocate a project code. Please try again.');
}

export async function update(actor: SessionUser, id: string, input: UpdateProjectInput) {
  const project = await Project.findById(id);
  if (!project || !project.isActive) throw new AppError(404, 'Resource not found');

  if (project.status === 'completed') {
    const keys = Object.keys(input);
    const isRestart = keys.length === 1 && keys[0] === 'status' && input.status !== undefined && input.status !== 'completed';
    if (!isRestart) throw new AppError(400, READ_ONLY_MESSAGE);
  }

  if (input.projectManager !== undefined) {
    const next = input.projectManager;
    const current = idOf(project.projectManager) ?? null;
    if (next !== current) {
      if (!isAdmin(actor) && next !== actor.id) throw new AppError(403, 'You cannot reassign the project manager');
      if (next) await assertActiveUser(next, 'projectManager');
      project.projectManager = next ? new mongoose.Types.ObjectId(next) : undefined;
    }
  }

  if (input.motive !== undefined) {
    const client = await Client.findById(project.client).select('companyName');
    if (!client) throw new AppError(400, 'Validation failed', { errors: [{ field: 'client', message: 'The client of this project no longer exists' }] });
    const naming = buildProjectNaming(client.companyName, input.motive);
    if (!naming.ok) throw new AppError(400, 'Validation failed', { errors: [{ field: naming.field, message: naming.error }] });
    if (naming.name !== project.name) {
      await assertNameFree(naming.name, id);
      project.name = naming.name; // the code deliberately stays as issued: it is the project's stable reference
    }
  }

  if (input.description !== undefined) project.description = input.description;
  if (input.startDate !== undefined) project.startDate = input.startDate;
  if (input.priority !== undefined) project.priority = input.priority;
  if (input.notes !== undefined) project.notes = input.notes;
  if (input.tags !== undefined) project.tags = input.tags;

  let statusChange: { from: ProjectStatus; to: ProjectStatus } | null = null;
  if (input.status !== undefined && input.status !== project.status) {
    statusChange = { from: project.status, to: input.status };
    project.status = input.status;
    if (input.status === 'completed') project.actualEndDate = new Date();
    else project.actualEndDate = undefined;
    project.activities.push({
      type: 'status_change',
      description: `Status changed from ${PROJECT_STATUS_LABELS[statusChange.from]} to ${PROJECT_STATUS_LABELS[statusChange.to]}`,
      user: new mongoose.Types.ObjectId(actor.id),
    } as never);
  }

  try {
    await project.save();
  } catch (err) {
    if (isDuplicateKey(err)) throw conflict(`A project named "${project.name}" already exists. Use a different motive.`);
    throw err;
  }

  await recordAudit({
    user: actor.id,
    action: statusChange ? 'status_change' : 'update',
    entity: 'project',
    entityId: id,
    description: statusChange
      ? `Project ${project.name}: ${PROJECT_STATUS_LABELS[statusChange.from]} → ${PROJECT_STATUS_LABELS[statusChange.to]}`
      : `Updated project ${project.name}`,
  });

  return get(id);
}

export async function remove(actor: SessionUser, id: string): Promise<{ hardDeleted: boolean }> {
  const project = await Project.findById(id);
  if (!project) throw new AppError(404, 'Resource not found');

  const hardDelete = actor.role === 'superadmin';
  if (hardDelete) {
    // Cards only mean something inside their project, so they go with it (Flare left them orphaned).
    await ProjectCard.deleteMany({ project: project._id });
    await project.deleteOne();
  } else {
    project.isActive = false;
    project.status = 'cancelled';
    await project.save();
  }

  await recordAudit({
    user: actor.id,
    action: 'delete',
    entity: 'project',
    entityId: id,
    description: `${hardDelete ? 'Deleted' : 'Archived'} project ${project.name}`,
  });

  return { hardDeleted: hardDelete };
}

async function loadEditableProject(id: string): Promise<ProjectDocument> {
  const project = await Project.findById(id);
  if (!project || !project.isActive) throw new AppError(404, 'Resource not found');
  if (project.status === 'completed') throw new AppError(400, READ_ONLY_MESSAGE);
  return project;
}

export async function addTeamMember(actor: SessionUser, id: string, input: AddTeamMemberInput) {
  const project = await loadEditableProject(id);
  if (project.team.some((m) => String(m.user) === input.user)) throw conflict('That person is already on the team');
  await assertActiveUser(input.user, 'user');

  project.team.push({ user: new mongoose.Types.ObjectId(input.user), role: input.role } as never);
  project.activities.push({ type: 'team_change', description: 'Team member added', user: new mongoose.Types.ObjectId(actor.id) } as never);
  await project.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'project', entityId: id, description: `Added a team member to ${project.name}` });
  return get(id);
}

export async function updateTeamMember(actor: SessionUser, id: string, memberId: string, input: UpdateTeamMemberInput) {
  const project = await loadEditableProject(id);
  const member = project.team.id(memberId);
  if (!member) throw new AppError(404, 'Resource not found');

  member.role = input.role;
  await project.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'project', entityId: id, description: `Changed a team member's role on ${project.name}` });
  return get(id);
}

export async function removeTeamMember(actor: SessionUser, id: string, memberId: string) {
  const project = await loadEditableProject(id);
  const member = project.team.id(memberId);
  if (!member) throw new AppError(404, 'Resource not found');

  // A person who is still on open cards (and isn't the project manager, who stays eligible) can't just
  // vanish from the team: the cards would be left with an assignee who is no longer a project member.
  const userId = String(member.user);
  if (idOf(project.projectManager) !== userId) {
    const openCards = await ProjectCard.countDocuments({ project: project._id, assignees: userId, status: { $ne: 'done' } });
    if (openCards > 0) {
      throw conflict(`This person is assigned to ${openCards} open ${openCards === 1 ? 'card' : 'cards'}. Reassign them before removing them from the team.`);
    }
  }

  member.deleteOne();
  project.activities.push({ type: 'team_change', description: 'Team member removed', user: new mongoose.Types.ObjectId(actor.id) } as never);
  await project.save();

  await recordAudit({ user: actor.id, action: 'update', entity: 'project', entityId: id, description: `Removed a team member from ${project.name}` });
  return get(id);
}

/** Active projects for a client (used by the client page). */
export async function listForClient(clientId: string) {
  const projects = await populateForList(Project.find({ client: clientId, isActive: true }).sort({ createdAt: -1 }).limit(50));
  const cardsByProject = await loadCardsFor(projects.map((p) => p._id));
  return projects.map((p) => withHealth(serializeProject(p), cardsByProject.get(String(p._id)) ?? []));
}

export async function countActiveForClient(clientId: string): Promise<number> {
  return Project.countDocuments({ client: clientId, isActive: true });
}

/** Active clients for the project form and filters. Names only, alphabetical. */
export async function clientOptions() {
  const clients = await Client.find({ isActive: true })
    .select('companyName')
    .sort({ companyName: 1 })
    .collation(NAME_COLLATION)
    .limit(1000)
    .lean();
  return clients.map((c) => ({ id: String(c._id), companyName: c.companyName }));
}
