import { requireUser } from '@/lib/auth/session';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { DetailPageContainer } from '@/components/layout/DetailPageContainer';
import { ProfileClient } from '@/components/profile/ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <DetailPageContainer>
      <SetPageTitle title="Profile" />
      <h1 className="mb-6 text-h1 text-navaro-green">Profile</h1>
      <ProfileClient user={user} />
    </DetailPageContainer>
  );
}
