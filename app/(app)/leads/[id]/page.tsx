import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import { AppError } from '@/lib/api/errors';
import * as leadsService from '@/services/leads';
import * as usersService from '@/services/users';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { DetailPageContainer } from '@/components/layout/DetailPageContainer';
import { LeadDetailClient } from '@/components/leads/LeadDetailClient';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  await requirePagePermission('leads.view');
  await connectDB();

  let lead;
  try {
    lead = await leadsService.get(params.id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  const assignableUsers = await usersService.assignable();

  return (
    <DetailPageContainer>
      <SetPageTitle title={`Leads / ${lead.fullName}`} />
      <LeadDetailClient lead={lead as never} assignableUsers={assignableUsers} />
    </DetailPageContainer>
  );
}
