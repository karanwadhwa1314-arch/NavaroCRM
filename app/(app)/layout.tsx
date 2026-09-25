import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/session';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <SessionProvider user={user}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
