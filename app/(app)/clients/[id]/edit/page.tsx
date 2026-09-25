import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import { AppError } from '@/lib/api/errors';
import * as clientsService from '@/services/clients';
import * as usersService from '@/services/users';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { DetailPageContainer } from '@/components/layout/DetailPageContainer';
import { ClientEditClient } from '@/components/clients/ClientEditClient';

export const dynamic = 'force-dynamic';

export default async function ClientEditPage({ params }: { params: { id: string } }) {
  await requirePagePermission('clients.edit');
  await connectDB();

  let client;
  try {
    client = await clientsService.get(params.id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  const assignableUsers = await usersService.assignable();

  return (
    <DetailPageContainer>
      <SetPageTitle title={`Clients / ${client.companyName} / Edit`} />
      <ClientEditClient client={client as never} assignableUsers={assignableUsers} />
    </DetailPageContainer>
  );
}
