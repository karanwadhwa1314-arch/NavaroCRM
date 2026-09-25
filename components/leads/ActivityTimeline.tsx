import { StickyNote, Phone, Mail, Users, ArrowRightLeft, UserCheck } from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { ACTIVITY_TYPE_LABELS, type ActivityType } from '@/lib/constants';

const ICONS: Record<ActivityType, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Users,
  status_change: ArrowRightLeft,
  assignment: UserCheck,
};

export interface Activity {
  _id?: string;
  type: ActivityType;
  description: string;
  user?: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-body text-navaro-muted">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {activities.map((activity, i) => {
        const Icon = ICONS[activity.type];
        return (
          <li key={activity._id ?? i} className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navaro-green">
              <Icon className="h-3.5 w-3.5 text-navaro-heath" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-navaro-green">{activity.description}</p>
              <p className="text-label text-navaro-muted">
                {ACTIVITY_TYPE_LABELS[activity.type]}
                {activity.user ? ` · ${activity.user.firstName} ${activity.user.lastName}` : ''} ·{' '}
                <span title={formatDate(activity.createdAt, 'd MMM yyyy, HH:mm')}>{formatRelativeTime(activity.createdAt)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
