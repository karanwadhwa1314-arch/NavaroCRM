import { Inbox } from 'lucide-react';
import { requireUser, hasPermission } from '@/lib/auth/session';
import { getDashboard } from '@/services/dashboard';
import { connectDB } from '@/lib/db';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PipelineBars } from '@/components/dashboard/PipelineBars';
import { SourceBars } from '@/components/dashboard/SourceBars';
import { RecentLeads } from '@/components/dashboard/RecentLeads';
import { SetPageTitle } from '@/components/layout/PageHeaderContext';

export const dynamic = 'force-dynamic';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const user = await requireUser();
  await connectDB();
  const { leads, clients } = await getDashboard(user);

  const hasAnyAccess = hasPermission(user, 'leads.view') || hasPermission(user, 'clients.view');

  return (
    <>
      <SetPageTitle title="Dashboard" />
      <h1 className="mb-6 text-h1 text-navaro-green">
        {greeting()}, {user.firstName}
      </h1>

      {!hasAnyAccess && (
        <EmptyState
          icon={Inbox}
          title="No access yet"
          body="Your account doesn't have access to any modules yet. Ask an administrator."
        />
      )}

      {hasAnyAccess && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {leads && (
              <>
                <KpiCard label="Open leads" value={leads.total} accent="green" />
                <KpiCard label="New leads this month" value={leads.newThisMonth} accent="yellow" />
              </>
            )}
            {clients && (
              <>
                <KpiCard label="Active clients" value={clients.active} accent="turquoise" />
                <KpiCard label="New clients this month" value={clients.newThisMonth} accent="turquoise" />
              </>
            )}
          </div>

          {leads && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card padding={false}>
                <CardHeader title="Pipeline by stage" />
                <div className="p-6">
                  <PipelineBars byStage={leads.byStage} />
                  <div className="mt-4 flex gap-6 border-t border-navaro-line pt-4 text-sm">
                    <span className="text-navaro-green">
                      Won <strong>{leads.byStage.won ?? 0}</strong>
                    </span>
                    <span className="text-navaro-muted">
                      Lost <strong>{leads.byStage.lost ?? 0}</strong>
                    </span>
                  </div>
                </div>
              </Card>

              <Card padding={false}>
                <CardHeader title="Leads by source" />
                <div className="p-6">
                  <SourceBars items={leads.bySourceTop5} />
                </div>
              </Card>
            </div>
          )}

          {leads && Object.keys(leads.openPipelineByCurrency).length > 0 && (
            <Card>
              <h2 className="mb-2 text-h3 text-navaro-green">Open pipeline value</h2>
              <p className="text-body text-navaro-muted">
                {Object.entries(leads.openPipelineByCurrency)
                  .map(([currency, total]) => `${currency} ${Number(total).toLocaleString()}`)
                  .join(' · ')}
              </p>
            </Card>
          )}

          {leads && (
            <Card padding={false}>
              <CardHeader title="Recent leads" action={<a href="/leads" className="text-sm text-navaro-green hover:underline">View all leads</a>} />
              <div className="px-6">
                <RecentLeads leads={leads.recent} />
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
