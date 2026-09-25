import Link from 'next/link';
import { LeadStageBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/format';
import type { LeadStage } from '@/lib/constants';

interface RecentLead {
  id: string;
  fullName: string;
  company: string;
  stage: LeadStage;
  createdAt: string;
}

export function RecentLeads({ leads }: { leads: RecentLead[] }) {
  if (leads.length === 0) {
    return <p className="text-body text-navaro-muted">No leads yet.</p>;
  }

  return (
    <ul className="divide-y divide-navaro-line">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-navaro-hover">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navaro-green">{lead.fullName}</p>
              <p className="truncate text-label text-navaro-muted">{lead.company}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <LeadStageBadge stage={lead.stage} />
              <span className="text-label text-navaro-muted">{formatDate(lead.createdAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
