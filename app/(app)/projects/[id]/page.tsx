import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import { AppError } from '@/lib/api/errors';
import * as projectsService from '@/services/projects';
import * as cardsService from '@/services/project-cards';
import * as usersService from '@/services/users';
import { hasPermission } from '@/lib/permissions';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { DetailPageContainer } from '@/components/layout/DetailPageContainer';
import { ProjectDetailClient, type ProjectDetail } from '@/components/projects/ProjectDetailClient';
import type { CardRecord } from '@/components/projects/CardFormModal';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission('projects.view');
  await connectDB();

  let project;
  let cards;
  try {
    [project, { cards }] = await Promise.all([projectsService.get(params.id), cardsService.list(params.id)]);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  // The people picker is only needed by someone who can add team members or change the project manager.
  const assignableUsers = hasPermission(user, 'projects.edit') ? await usersService.assignable() : [];

  return (
    <DetailPageContainer>
      <SetPageTitle title={`Projects / ${project.name}`} />
      <ProjectDetailClient project={project as unknown as ProjectDetail} cards={cards as unknown as CardRecord[]} assignableUsers={assignableUsers} />
    </DetailPageContainer>
  );
}
