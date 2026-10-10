import mongoose from 'mongoose';
import Project, { type ProjectDocument } from '@/models/Project';
import ProjectCard, { type ProjectCardDocument } from '@/models/ProjectCard';
import User from '@/models/User';
import { AppError } from '@/lib/api/errors';
import { recordAudit } from '@/services/audit';
import { READ_ONLY_MESSAGE, userRef } from '@/services/projects';
import { sendEmail, cardAssignedEmail } from '@/lib/email';
import { calculateDeadlineHealth, getHealthLevel, MIN_HEALTH } from '@/lib/project-health';
import { computeNextOccurrenceDate } from '@/lib/card-recurrence';
import { DONE_CARD_RETENTION_DAYS } from '@/lib/constants';
import type { SessionUser } from '@/lib/auth/session';
import type { CreateCardInput, UpdateCardInput } from '@/lib/validation/project';

type UserRefValue = NonNullable<ReturnType<typeof userRef>>;

export function serializeCard(card: ProjectCardDocument) {
  const obj = card.toObject();
  return {
    id: String(obj._id),
    projectId: String(obj.project),
    title: obj.title,
    description: obj.description,
    fileLink: obj.fileLink,
    status: obj.status,
    deadline: obj.deadline ?? null,
    doneAt: obj.doneAt ?? null,
    assignees: (obj.assignees as unknown[] ?? []).map((a) => userRef(a)).filter((a): a is UserRefValue => a !== null),
    createdBy: userRef(obj.createdBy),
    recurrence: {
      type: obj.recurrence?.type ?? 'none',
      daysOfWeek: obj.recurrence?.daysOfWeek ?? [],
      dayOfMonth: obj.recurrence?.dayOfMonth ?? null,
    },
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function loadCard(projectId: string, cardId: string) {
  return ProjectCard.findOne({ _id: cardId, project: projectId })
    .populate('assignees', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName');
}

async function loadProject(id: string): Promise<ProjectDocument> {
  const project = await Project.findById(id);
  if (!project || !project.isActive) throw new AppError(404, 'Resource not found');
  return project;
}

/** People who can be given a card: the project's team plus its project manager. */
function eligibleAssigneeIds(project: ProjectDocument): Set<string> {
  const ids = new Set<string>(project.team.map((m) => String(m.user)));
  if (project.projectManager) ids.add(String(project.projectManager));
  return ids;
}

function assertAssigneesEligible(assigneeIds: string[], project: ProjectDocument): void {
  const eligible = eligibleAssigneeIds(project);
  if (assigneeIds.some((id) => !eligible.has(id))) {
    throw new AppError(400, 'Validation failed', {
      errors: [{ field: 'assignees', message: "One or more assignees are not members of this project's team" }],
    });
  }
}

function assertWritable(project: ProjectDocument): void {
  if (project.status === 'completed') throw new AppError(400, READ_ONLY_MESSAGE);
}

const uniq = (ids: string[]) => Array.from(new Set(ids));

export async function list(projectId: string) {
  await loadProject(projectId);
  const cards = await ProjectCard.find({ project: projectId })
    .populate('assignees', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: 1 });
  const deadlineHealth = calculateDeadlineHealth(cards);
  return { cards: cards.map(serializeCard), deadlineHealth, healthLevel: getHealthLevel(deadlineHealth) };
}

/** Emails each newly assigned person. Best effort: a mail failure must never fail the card write. */
async function notifyAssignees(project: ProjectDocument, card: ProjectCardDocument, assigneeIds: string[], actor: SessionUser): Promise<void> {
  const recipients = assigneeIds.filter((id) => id !== actor.id);
  if (recipients.length === 0) return;
  try {
    const users = await User.find({ _id: { $in: recipients }, isActive: true }).select('firstName email').lean();
    await Promise.all(
      users.map((u) =>
        sendEmail(
          cardAssignedEmail({
            projectId: String(project._id),
            projectName: project.name,
            cardTitle: card.title,
            cardDescription: card.description,
            deadline: card.deadline,
            assigneeEmail: u.email,
            assigneeFirstName: u.firstName,
            assignedByName: `${actor.firstName} ${actor.lastName}`.trim(),
          })
        ).catch((err) => console.error('Card assignment email failed:', err))
      )
    );
  } catch (err) {
    console.error('Card assignment notification failed:', err);
  }
}

export async function create(actor: SessionUser, projectId: string, input: CreateCardInput) {
  const project = await loadProject(projectId);
  assertWritable(project);

  const existing = await ProjectCard.find({ project: projectId }).select('status deadline').lean();
  if (calculateDeadlineHealth(existing) <= MIN_HEALTH) {
    throw new AppError(400, 'Project health is critically low. Resolve missed deadlines before creating new cards.');
  }

  const status = input.status ?? 'todo';
  if (status === 'in_progress' && !input.deadline) {
    throw new AppError(400, 'Validation failed', { errors: [{ field: 'deadline', message: 'A deadline is required for an in-progress card' }] });
  }

  const assignees = uniq(input.assignees);
  assertAssigneesEligible(assignees, project);

  const recurrence = input.recurrence ?? { type: 'none' as const };
  const card = await ProjectCard.create({
    title: input.title,
    description: input.description,
    fileLink: input.fileLink ?? '',
    status,
    assignees,
    deadline: input.deadline ?? null,
    doneAt: status === 'done' ? new Date() : null,
    project: projectId,
    createdBy: actor.id,
    recurrence: {
      type: recurrence.type,
      daysOfWeek: recurrence.type === 'weekly' ? recurrence.daysOfWeek : [],
      dayOfMonth: recurrence.type === 'monthly' ? recurrence.dayOfMonth : undefined,
    },
    recurrenceSeriesId: recurrence.type !== 'none' ? new mongoose.Types.ObjectId() : undefined,
  });

  await recordAudit({ user: actor.id, action: 'update', entity: 'project', entityId: projectId, description: `Added card "${card.title}" to ${project.name}` });
  void notifyAssignees(project, card, assignees, actor);

  return serializeCard((await loadCard(projectId, String(card._id)))!);
}

export async function update(actor: SessionUser, projectId: string, cardId: string, input: UpdateCardInput) {
  const project = await loadProject(projectId);
  assertWritable(project);

  const card = await ProjectCard.findOne({ _id: cardId, project: projectId });
  if (!card) throw new AppError(404, 'Resource not found');

  // A Done card is a record of finished work: nothing about it can change any more.
  if (card.status === 'done') throw new AppError(400, 'This card is marked Done and can no longer be edited');

  const previousAssignees = card.assignees.map(String);
  if (input.assignees !== undefined) {
    if (input.assignees.length === 0) {
      throw new AppError(400, 'Validation failed', { errors: [{ field: 'assignees', message: 'A card must have at least one assigned team member' }] });
    }
    // Only people being added need to be current project members; existing assignees may predate a team change.
    const added = uniq(input.assignees).filter((id) => !previousAssignees.includes(id));
    if (added.length > 0) assertAssigneesEligible(added, project);
  }

  const nextStatus = input.status ?? card.status;
  const nextDeadline = input.deadline !== undefined ? input.deadline : card.deadline;
  if (nextStatus === 'in_progress' && !nextDeadline) {
    throw new AppError(400, 'Validation failed', { errors: [{ field: 'deadline', message: 'A deadline is required for an in-progress card' }] });
  }

  const transitioningToDone = input.status === 'done';

  if (input.title !== undefined) card.title = input.title;
  if (input.description !== undefined) card.description = input.description;
  if (input.fileLink !== undefined) card.fileLink = input.fileLink;
  if (input.deadline !== undefined) card.deadline = input.deadline;
  if (input.assignees !== undefined) card.assignees = uniq(input.assignees).map((id) => new mongoose.Types.ObjectId(id));
  if (input.status !== undefined) {
    if (transitioningToDone) card.doneAt = new Date();
    card.status = input.status;
  }
  if (input.recurrence !== undefined) {
    card.recurrence = {
      type: input.recurrence.type,
      daysOfWeek: input.recurrence.type === 'weekly' ? input.recurrence.daysOfWeek ?? [] : [],
      dayOfMonth: input.recurrence.type === 'monthly' ? input.recurrence.dayOfMonth : undefined,
    };
    if (input.recurrence.type !== 'none' && !card.recurrenceSeriesId) card.recurrenceSeriesId = new mongoose.Types.ObjectId();
  }

  await card.save();

  // Finishing one occurrence of a recurring card creates the next, anchored on the completion day.
  if (transitioningToDone && card.recurrence.type !== 'none') {
    const nextDay = computeNextOccurrenceDate(card.recurrence, card.doneAt ?? new Date());
    if (nextDay) {
      if (card.deadline) {
        const src = new Date(card.deadline);
        nextDay.setHours(src.getHours(), src.getMinutes(), src.getSeconds(), src.getMilliseconds());
      }
      const nextCard = await ProjectCard.create({
        title: card.title,
        description: card.description,
        fileLink: card.fileLink,
        project: card.project,
        assignees: card.assignees,
        recurrence: card.recurrence,
        recurrenceSeriesId: card.recurrenceSeriesId,
        status: 'todo',
        deadline: nextDay,
        doneAt: null,
        createdBy: card.createdBy,
      });
      void notifyAssignees(project, nextCard, card.assignees.map(String), actor);
    }
  }

  const newlyAssigned = card.assignees.map(String).filter((id) => !previousAssignees.includes(id));
  void notifyAssignees(project, card, newlyAssigned, actor);

  await recordAudit({
    user: actor.id,
    action: input.status ? 'status_change' : 'update',
    entity: 'project',
    entityId: projectId,
    description: `Updated card "${card.title}" in ${project.name}`,
  });

  return serializeCard((await loadCard(projectId, cardId))!);
}

export async function remove(actor: SessionUser, projectId: string, cardId: string) {
  const project = await loadProject(projectId);
  assertWritable(project);

  const card = await ProjectCard.findOneAndDelete({ _id: cardId, project: projectId });
  if (!card) throw new AppError(404, 'Resource not found');

  await recordAudit({ user: actor.id, action: 'update', entity: 'project', entityId: projectId, description: `Deleted card "${card.title}" from ${project.name}` });
  return { deleted: true };
}

/** Nightly clean-up: Done cards disappear DONE_CARD_RETENTION_DAYS days after they were completed. */
export async function expireDoneCards(now: Date = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - DONE_CARD_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await ProjectCard.deleteMany({ status: 'done', doneAt: { $lte: cutoff } });
  return { deleted: result.deletedCount ?? 0 };
}
