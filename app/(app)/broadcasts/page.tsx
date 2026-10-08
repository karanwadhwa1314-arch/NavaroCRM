import { requirePagePermission } from '@/lib/auth/session';
import { connectDB } from '@/lib/db';
import * as broadcasts from '@/services/broadcasts';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';
import { BroadcastsClient } from '@/components/broadcasts/BroadcastsClient';
import type { BroadcastItem } from '@/components/broadcasts/types';

export const dynamic = 'force-dynamic';

export default async function BroadcastsPage() {
  await connectDB();
  const [, items, leadCount] = await Promise.all([requirePagePermission('broadcasts.view'), broadcasts.list(), broadcasts.audienceEstimate()]);

  return (
    <>
      <SetPageTitle title="Broadcasts" />
      <BroadcastsClient
        items={items as unknown as BroadcastItem[]}
        emailConfigured={broadcasts.emailConfigured()}
        sender={broadcasts.getSenderConfig().email}
        leadCount={leadCount}
      />
    </>
  );
}
