import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/project-cards/route';
import ProjectCard from '@/models/ProjectCard';
import Project from '@/models/Project';
import { createTestUser } from './helpers';

const SECRET = 'a-sufficiently-long-test-secret';
const call = (authorization?: string) =>
  GET(new NextRequest('http://localhost/api/cron/project-cards', { headers: authorization ? { authorization } : {} }));

const original = process.env.CRON_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe('project card clean-up endpoint', () => {
  it('is disabled (503) when no CRON_SECRET is configured', async () => {
    delete process.env.CRON_SECRET;
    expect((await call()).status).toBe(503);
  });

  it('rejects a missing or wrong secret with 401 and deletes nothing', async () => {
    process.env.CRON_SECRET = SECRET;
    const user = await createTestUser();
    const project = await Project.create({ name: 'X-Test', code: 'XXX-TES-001', client: user._id, startDate: new Date() });
    await ProjectCard.create({ title: 'Old', project: project._id, status: 'done', doneAt: new Date(Date.now() - 20 * 86_400_000), assignees: [user._id], createdBy: user._id });

    expect((await call()).status).toBe(401);
    expect((await call('Bearer nope')).status).toBe(401);
    expect(await ProjectCard.countDocuments()).toBe(1);
  });

  it('with the right secret removes Done cards older than 10 days and reports the count', async () => {
    process.env.CRON_SECRET = SECRET;
    const user = await createTestUser();
    const project = await Project.create({ name: 'X-Test', code: 'XXX-TES-001', client: user._id, startDate: new Date() });
    await ProjectCard.create([
      { title: 'Old', project: project._id, status: 'done', doneAt: new Date(Date.now() - 20 * 86_400_000), assignees: [user._id], createdBy: user._id },
      { title: 'Recent', project: project._id, status: 'done', doneAt: new Date(), assignees: [user._id], createdBy: user._id },
    ]);

    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, deleted: 1 });
    expect((await ProjectCard.find()).map((c) => c.title)).toEqual(['Recent']);
  });
});
