import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import { AppError } from '@/lib/api/errors';
import * as clientsService from '@/services/clients';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { DetailPageContainer } from '@/components/layout/DetailPageContainer';
import { ClientDetailClient } from '@/components/clients/ClientDetailClient';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  await requirePagePermission('clients.view');
  await connectDB();

  let client;
  try {
    client = await clientsService.get(params.id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  return (
    <DetailPageContainer>
      <SetPageTitle title={`Clients / ${client.companyName}`} />
      <ClientDetailClient client={client as never} />
    </DetailPageContainer>
  );
}
