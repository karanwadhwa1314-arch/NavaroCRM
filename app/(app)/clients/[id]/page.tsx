import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/session';
import { hasPermission } from '@/lib/permissions';
import { connectDB } from '@/lib/db';
import { AppError } from '@/lib/api/errors';
import * as clientsService from '@/services/clients';
import * as projectsService from '@/services/projects';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { DetailPageContainer } from '@/components/layout/DetailPageContainer';
import { ClientDetailClient } from '@/components/clients/ClientDetailClient';
import { ClientProjectsCard, type ClientProject } from '@/components/projects/ClientProjectsCard';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission('clients.view');
  await connectDB();

  let client;
  try {
    client = await clientsService.get(params.id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  // Projects only appear for people who may see them; the client page itself needs just clients.view.
  const projects = hasPermission(user, 'projects.view') ? await projectsService.listForClient(params.id) : null;

  return (
    <DetailPageContainer>
      <SetPageTitle title={`Clients / ${client.companyName}`} />
      <ClientDetailClient
        client={client as never}
        projectsSlot={
          projects && (
            <ClientProjectsCard clientId={params.id} projects={projects as unknown as ClientProject[]} canCreate={hasPermission(user, 'projects.create')} />
          )
        }
      />
    </DetailPageContainer>
  );
}
