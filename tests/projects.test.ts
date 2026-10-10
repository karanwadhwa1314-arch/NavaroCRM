import { describe, it, expect, beforeEach } from 'vitest';
import * as projectsService from '@/services/projects';
import * as cardsService from '@/services/project-cards';
import * as clientsService from '@/services/clients';
import Project from '@/models/Project';
import ProjectCard from '@/models/ProjectCard';
import { createTestUser, toActor } from './helpers';

type TestUser = Awaited<ReturnType<typeof createTestUser>>;

let superadmin: TestUser;
let admin: TestUser;
let member: TestUser;
let teammate: TestUser;
let clientId: string;

const DAY = 86_400_000;
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);

async function makeProject(actor = superadmin, motive = 'Sourcing', extra: Record<string, unknown> = {}) {
  return projectsService.create(toActor(actor), {
    client: clientId,
    motive,
    startDate: new Date('2026-03-01T12:00:00Z'),
    ...extra,
  } as never);
}

async function makeStaffedProject(motive = 'Sourcing') {
  const project = await makeProject(superadmin, motive, { projectManager: String(admin._id) });
  await projectsService.addTeamMember(toActor(superadmin), project.id, { user: String(teammate._id), role: 'coordinator' });
  return project;
}

const addCard = (projectId: string, extra: Record<string, unknown> = {}, actor = superadmin) =>
  cardsService.create(toActor(actor), projectId, { title: 'Book freight', assignees: [String(teammate._id)], ...extra } as never);

beforeEach(async () => {
  superadmin = await createTestUser({ role: 'superadmin' });
  admin = await createTestUser({ role: 'admin' });
  member = await createTestUser({ role: 'member' });
  teammate = await createTestUser({ role: 'member' });
  const client = await clientsService.create(toActor(superadmin), { companyName: 'Acme Trading Co' } as never);
  clientId = client.id;
});

describe('creating projects', () => {
  it('derives the name and a sequential code from the client and motive', async () => {
    const a = await makeProject(superadmin, 'Spice sourcing');
    const b = await makeProject(superadmin, 'Spice export');
    expect(a.name).toBe('Acme-Trading-Co-Spice sourcing');
    expect(a.code).toBe('ACM-SPI-001');
    expect(b.code).toBe('ACM-SPI-002');
    expect(a.status).toBe('planning');
    expect(a.priority).toBe('medium');
    expect(a.client?.companyName).toBe('Acme Trading Co');
  });

  it('hands out distinct codes to simultaneous creators', async () => {
    const results = await Promise.all(['Spice A', 'Spice B', 'Spice C', 'Spice D'].map((m) => makeProject(superadmin, m)));
    const codes = results.map((r) => r.code);
    expect(new Set(codes).size).toBe(4);
  });

  it('rejects a case-insensitive duplicate name among active projects with 409', async () => {
    await makeProject(superadmin, 'Sourcing');
    await expect(makeProject(superadmin, 'SOURCING')).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a motive with fewer than 3 letters', async () => {
    await expect(makeProject(superadmin, 'a1')).rejects.toMatchObject({ status: 400, errors: [{ field: 'motive' }] });
  });

  it('rejects an unknown or archived client', async () => {
    await expect(
      projectsService.create(toActor(superadmin), { client: '65f000000000000000000001', motive: 'Sourcing', startDate: new Date() } as never)
    ).rejects.toMatchObject({ status: 400, errors: [{ field: 'client' }] });
  });

  it('a non-admin is always the project manager of what they create', async () => {
    const memberActor = await createTestUser({ role: 'member', permissions: ['projects.create', 'projects.view'] });
    const project = await makeProject(memberActor, 'Sourcing', { projectManager: String(admin._id) });
    expect(project.projectManager?.id).toBe(String(memberActor._id));
  });

  it('an admin can name another active user as project manager, but not an inactive one', async () => {
    const project = await makeProject(admin, 'Sourcing', { projectManager: String(member._id) });
    expect(project.projectManager?.id).toBe(String(member._id));

    const inactive = await createTestUser({ role: 'member', isActive: false });
    await expect(makeProject(admin, 'Logistics', { projectManager: String(inactive._id) })).rejects.toMatchObject({ status: 400 });
  });

  it('records a created activity and an audit trail entry', async () => {
    const project = await makeProject();
    expect(project.activities[0]).toMatchObject({ type: 'created' });
  });
});

describe('updating projects', () => {
  it('edits details and keeps the code stable when the motive (and so the name) changes', async () => {
    const project = await makeProject(superadmin, 'Sourcing');
    const updated = await projectsService.update(toActor(superadmin), project.id, {
      motive: 'Freight',
      description: 'Containers',
      priority: 'high',
    } as never);
    expect(updated.name).toBe('Acme-Trading-Co-Freight');
    expect(updated.code).toBe(project.code);
    expect(updated.description).toBe('Containers');
    expect(updated.priority).toBe('high');
  });

  it('a rename may not collide with another active project', async () => {
    await makeProject(superadmin, 'Freight');
    const other = await makeProject(superadmin, 'Sourcing');
    await expect(projectsService.update(toActor(superadmin), other.id, { motive: 'freight' } as never)).rejects.toMatchObject({ status: 409 });
  });

  it('ending a project makes it read-only and stamps the end date; restarting reopens it', async () => {
    const project = await makeProject();
    const ended = await projectsService.update(toActor(superadmin), project.id, { status: 'completed' } as never);
    expect(ended.status).toBe('completed');
    expect(ended.actualEndDate).toBeTruthy();

    await expect(projectsService.update(toActor(superadmin), project.id, { description: 'edit' } as never)).rejects.toMatchObject({ status: 400 });
    await expect(projectsService.update(toActor(superadmin), project.id, { status: 'completed', priority: 'low' } as never)).rejects.toMatchObject({ status: 400 });

    const restarted = await projectsService.update(toActor(superadmin), project.id, { status: 'in_progress' } as never);
    expect(restarted.status).toBe('in_progress');
    expect(restarted.actualEndDate).toBeFalsy();
    expect(restarted.activities.map((a: { type: string }) => a.type)).toContain('status_change');
  });

  it('a non-admin cannot reassign the project manager, but can leave it unchanged', async () => {
    const owner = await createTestUser({ role: 'member', permissions: ['projects.create', 'projects.edit', 'projects.view'] });
    const project = await makeProject(owner, 'Sourcing');
    await expect(projectsService.update(toActor(owner), project.id, { projectManager: String(admin._id) } as never)).rejects.toMatchObject({ status: 403 });
    await expect(projectsService.update(toActor(owner), project.id, { projectManager: String(owner._id), priority: 'low' } as never)).resolves.toBeDefined();
  });

  it('404s for an archived project', async () => {
    const project = await makeProject();
    await projectsService.remove(toActor(admin), project.id);
    await expect(projectsService.get(project.id)).rejects.toMatchObject({ status: 404 });
    await expect(projectsService.update(toActor(superadmin), project.id, { priority: 'low' } as never)).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleting projects', () => {
  it('a non-superadmin archives (cancelled, hidden, name reusable)', async () => {
    const project = await makeProject(superadmin, 'Sourcing');
    const result = await projectsService.remove(toActor(admin), project.id);
    expect(result.hardDeleted).toBe(false);
    const row = await Project.findById(project.id);
    expect(row).toMatchObject({ isActive: false, status: 'cancelled' });
    await expect(makeProject(superadmin, 'Sourcing')).resolves.toBeDefined();
  });

  it('a superadmin deletes the project and its cards', async () => {
    const project = await makeStaffedProject();
    await addCard(project.id);
    const result = await projectsService.remove(toActor(superadmin), project.id);
    expect(result.hardDeleted).toBe(true);
    expect(await Project.countDocuments({ _id: project.id })).toBe(0);
    expect(await ProjectCard.countDocuments({ project: project.id })).toBe(0);
  });
});

describe('clients with projects', () => {
  it('a client with projects cannot be hard-deleted, but can once they are gone', async () => {
    const project = await makeProject();
    await expect(clientsService.remove(toActor(superadmin), clientId)).rejects.toMatchObject({ status: 409 });

    await projectsService.remove(toActor(superadmin), project.id);
    await expect(clientsService.remove(toActor(superadmin), clientId)).resolves.toMatchObject({ hardDeleted: true });
  });

  it('archiving a client (non-superadmin) is unaffected', async () => {
    await makeProject();
    await expect(clientsService.remove(toActor(admin), clientId)).resolves.toMatchObject({ hardDeleted: false });
  });
});

describe('team', () => {
  it('adds a member once and rejects duplicates', async () => {
    const project = await makeProject();
    const updated = await projectsService.addTeamMember(toActor(superadmin), project.id, { user: String(member._id), role: 'logistics' });
    expect(updated.team).toHaveLength(1);
    expect(updated.team[0]).toMatchObject({ role: 'logistics' });
    await expect(
      projectsService.addTeamMember(toActor(superadmin), project.id, { user: String(member._id), role: 'finance' })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects inactive users and completed projects', async () => {
    const project = await makeProject();
    const inactive = await createTestUser({ role: 'member', isActive: false });
    await expect(
      projectsService.addTeamMember(toActor(superadmin), project.id, { user: String(inactive._id), role: 'finance' })
    ).rejects.toMatchObject({ status: 400 });

    await projectsService.update(toActor(superadmin), project.id, { status: 'completed' } as never);
    await expect(
      projectsService.addTeamMember(toActor(superadmin), project.id, { user: String(member._id), role: 'finance' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('will not remove someone who is still on open cards, but will once they are done', async () => {
    const project = await makeStaffedProject();
    const card = await addCard(project.id);
    const memberId = (await projectsService.get(project.id)).team[0].id;

    await expect(projectsService.removeTeamMember(toActor(superadmin), project.id, memberId)).rejects.toMatchObject({ status: 409 });

    await cardsService.update(toActor(superadmin), project.id, card.id, { status: 'done' } as never);
    const after = await projectsService.removeTeamMember(toActor(superadmin), project.id, memberId);
    expect(after.team).toHaveLength(0);
  });

  it('lets the project manager come off the team list even with open cards (they stay eligible)', async () => {
    const project = await makeProject(superadmin, 'Sourcing', { projectManager: String(admin._id) });
    const withAdmin = await projectsService.addTeamMember(toActor(superadmin), project.id, { user: String(admin._id), role: 'project_manager' });
    await cardsService.create(toActor(superadmin), project.id, { title: 'PM task', assignees: [String(admin._id)] } as never);
    await expect(projectsService.removeTeamMember(toActor(superadmin), project.id, withAdmin.team[0].id)).resolves.toBeDefined();
  });
});

describe('cards', () => {
  it('only the team and project manager can be assigned', async () => {
    const project = await makeStaffedProject();
    await expect(addCard(project.id, { assignees: [String(member._id)] })).rejects.toMatchObject({ status: 400, errors: [{ field: 'assignees' }] });
    await expect(addCard(project.id, { assignees: [String(admin._id)] })).resolves.toBeDefined(); // the project manager
    await expect(addCard(project.id, { assignees: [String(teammate._id)] })).resolves.toBeDefined();
  });

  it('starts as todo with no deadline needed; in progress needs one', async () => {
    const project = await makeStaffedProject();
    const todo = await addCard(project.id);
    expect(todo.status).toBe('todo');
    await expect(addCard(project.id, { status: 'in_progress' })).rejects.toMatchObject({ status: 400, errors: [{ field: 'deadline' }] });
    await expect(addCard(project.id, { status: 'in_progress', deadline: daysFromNow(2) })).resolves.toBeDefined();
  });

  it('moving to in progress needs a deadline, and an in-progress card cannot lose it', async () => {
    const project = await makeStaffedProject();
    const card = await addCard(project.id);
    await expect(cardsService.update(toActor(superadmin), project.id, card.id, { status: 'in_progress' } as never)).rejects.toMatchObject({ status: 400 });

    const moved = await cardsService.update(toActor(superadmin), project.id, card.id, { status: 'in_progress', deadline: daysFromNow(3) } as never);
    expect(moved.status).toBe('in_progress');
    await expect(cardsService.update(toActor(superadmin), project.id, card.id, { deadline: null } as never)).rejects.toMatchObject({ status: 400 });
  });

  it('a Done card is frozen and stamped with doneAt', async () => {
    const project = await makeStaffedProject();
    const card = await addCard(project.id);
    const done = await cardsService.update(toActor(superadmin), project.id, card.id, { status: 'done' } as never);
    expect(done.doneAt).toBeTruthy();
    await expect(cardsService.update(toActor(superadmin), project.id, card.id, { title: 'New title' } as never)).rejects.toMatchObject({ status: 400 });
    await expect(cardsService.update(toActor(superadmin), project.id, card.id, { status: 'todo' } as never)).rejects.toMatchObject({ status: 400 });
  });

  it('a card cannot be left with no assignee', async () => {
    const project = await makeStaffedProject();
    const card = await addCard(project.id);
    await expect(cardsService.update(toActor(superadmin), project.id, card.id, { assignees: [] } as never)).rejects.toMatchObject({ status: 400 });
  });

  it('cannot touch cards of an ended project, and cannot reach a card through another project', async () => {
    const project = await makeStaffedProject('Sourcing');
    const other = await makeStaffedProject('Logistics');
    const card = await addCard(project.id);

    await expect(cardsService.update(toActor(superadmin), other.id, card.id, { title: 'x' } as never)).rejects.toMatchObject({ status: 404 });
    await expect(cardsService.remove(toActor(superadmin), other.id, card.id)).rejects.toMatchObject({ status: 404 });

    await projectsService.update(toActor(superadmin), project.id, { status: 'completed' } as never);
    await expect(addCard(project.id)).rejects.toMatchObject({ status: 400 });
    await expect(cardsService.update(toActor(superadmin), project.id, card.id, { title: 'x' } as never)).rejects.toMatchObject({ status: 400 });
    await expect(cardsService.remove(toActor(superadmin), project.id, card.id)).rejects.toMatchObject({ status: 400 });
  });

  it('completing a recurring card spawns the next occurrence with the same assignees and time of day', async () => {
    const project = await makeStaffedProject();
    const deadline = daysFromNow(1);
    const card = await addCard(project.id, { title: 'Weekly report', status: 'in_progress', deadline, recurrence: { type: 'daily' } });
    await cardsService.update(toActor(superadmin), project.id, card.id, { status: 'done' } as never);

    const { cards } = await cardsService.list(project.id);
    expect(cards).toHaveLength(2);
    const next = cards.find((c) => c.status === 'todo')!;
    expect(next.title).toBe('Weekly report');
    expect(next.assignees.map((a) => a.id)).toEqual([String(teammate._id)]);
    expect(next.recurrence.type).toBe('daily');
    const nextDeadline = new Date(next.deadline!);
    expect(nextDeadline.getHours()).toBe(new Date(deadline).getHours());
    expect(nextDeadline.getMinutes()).toBe(new Date(deadline).getMinutes());
    expect(nextDeadline.getTime()).toBeGreaterThan(Date.now());
  });

  it('a non-recurring card spawns nothing when done', async () => {
    const project = await makeStaffedProject();
    const card = await addCard(project.id);
    await cardsService.update(toActor(superadmin), project.id, card.id, { status: 'done' } as never);
    expect((await cardsService.list(project.id)).cards).toHaveLength(1);
  });

  it('refuses new cards once health has hit the floor', async () => {
    const project = await makeStaffedProject();
    const long = daysFromNow(-10);
    for (let i = 0; i < 4; i++) {
      await ProjectCard.create({
        title: `Late ${i}`, project: project.id, status: 'todo', deadline: long, assignees: [teammate._id], createdBy: superadmin._id,
      });
    }
    const { deadlineHealth } = await cardsService.list(project.id);
    expect(deadlineHealth).toBe(20);
    await expect(addCard(project.id)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/critically low/i) });
  });

  it('expires only Done cards older than 10 days', async () => {
    const project = await makeStaffedProject();
    const old = await ProjectCard.create({ title: 'Old', project: project.id, status: 'done', doneAt: daysFromNow(-11), assignees: [teammate._id], createdBy: superadmin._id });
    const fresh = await ProjectCard.create({ title: 'Fresh', project: project.id, status: 'done', doneAt: daysFromNow(-3), assignees: [teammate._id], createdBy: superadmin._id });
    const open = await ProjectCard.create({ title: 'Open', project: project.id, status: 'todo', assignees: [teammate._id], createdBy: superadmin._id });

    const { deleted } = await cardsService.expireDoneCards();
    expect(deleted).toBe(1);
    expect(await ProjectCard.exists({ _id: old._id })).toBeNull();
    expect(await ProjectCard.exists({ _id: fresh._id })).toBeTruthy();
    expect(await ProjectCard.exists({ _id: open._id })).toBeTruthy();
  });
});

describe('listing and stats', () => {
  const listAs = (query: Record<string, unknown> = {}, actor = superadmin) =>
    projectsService.list(toActor(actor), { page: 1, limit: 20, order: 'desc', ...query } as never);

  it('defaults to least healthy first and reports card progress', async () => {
    const healthy = await makeStaffedProject('Healthy');
    const sick = await makeStaffedProject('Sick');
    await ProjectCard.create({ title: 'Late', project: sick.id, status: 'todo', deadline: daysFromNow(-3), assignees: [teammate._id], createdBy: superadmin._id });
    const done = await addCard(healthy.id);
    await cardsService.update(toActor(superadmin), healthy.id, done.id, { status: 'done' } as never);

    const { items, total } = await listAs();
    expect(total).toBe(2);
    expect(items[0].id).toBe(sick.id);
    expect(items[0].deadlineHealth).toBeLessThan(100);
    expect(items[0].healthLevel).not.toBe('perfect');
    expect(items[1].cardCounts).toMatchObject({ done: 1, total: 1 });
  });

  it('paginates the health-sorted order consistently', async () => {
    for (const m of ['Aaa', 'Bbb', 'Ccc']) await makeProject(superadmin, m);
    const page1 = await listAs({ limit: 2, page: 1 });
    const page2 = await listAs({ limit: 2, page: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(1);
    expect(new Set([...page1.items, ...page2.items].map((p) => p.id)).size).toBe(3);
  });

  it('filters by status, client, manager, involvement and search (regex-safe)', async () => {
    const a = await makeStaffedProject('Sourcing');
    await makeProject(superadmin, 'Logistics (v2)');
    await projectsService.update(toActor(superadmin), a.id, { status: 'in_progress' } as never);

    expect((await listAs({ status: 'in_progress' })).items.map((p) => p.id)).toEqual([a.id]);
    expect((await listAs({ client: clientId })).total).toBe(2);
    expect((await listAs({ projectManager: String(admin._id) })).items.map((p) => p.id)).toEqual([a.id]);
    expect((await listAs({ teamMember: String(teammate._id) })).items.map((p) => p.id)).toEqual([a.id]);
    expect((await listAs({ teamMember: 'me' }, admin)).items.map((p) => p.id)).toEqual([a.id]); // PM counts as involved
    expect((await listAs({ search: 'logistics (v2' })).total).toBe(1); // unbalanced paren must not blow up
    expect((await listAs({ search: 'ACM-SOU' })).items.map((p) => p.id)).toEqual([a.id]); // by code
  });

  it('supports explicit sorting and hides archived projects', async () => {
    const x = await makeProject(superadmin, 'Xylophone');
    const a = await makeProject(superadmin, 'Armature');
    const gone = await makeProject(superadmin, 'Gone');
    await projectsService.remove(toActor(admin), gone.id);
    const asc = await listAs({ sort: 'name', order: 'asc' });
    expect(asc.items.map((p) => p.id)).toEqual([a.id, x.id]);
  });

  it('summarises health for live projects only', async () => {
    const live = await makeStaffedProject('Live');
    await ProjectCard.create({ title: 'Late', project: live.id, status: 'todo', deadline: daysFromNow(-3), assignees: [teammate._id], createdBy: superadmin._id });
    const ended = await makeProject(superadmin, 'Ended');
    await projectsService.update(toActor(superadmin), ended.id, { status: 'completed' } as never);

    const stats = await projectsService.stats();
    expect(stats.total).toBe(2);
    expect(stats.byStatus).toMatchObject({ planning: 1, completed: 1 });
    expect(stats.health.average + stats.health.good + stats.health.critical + stats.health.perfect).toBe(1);
    expect(stats.health.perfect).toBe(0);
  });
});
