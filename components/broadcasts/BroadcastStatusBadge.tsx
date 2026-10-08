import { Check } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { BROADCAST_STATUS_LABELS, type BroadcastStatus } from '@/lib/constants';

// Brand roles: yellow = upcoming, turquoise = in progress, green = done, red = needs attention.
const TONE: Record<BroadcastStatus, BadgeTone> = {
  draft: 'outline',
  scheduled: 'yellowSolid',
  sending: 'turquoiseSolid',
  sent: 'green',
  failed: 'dangerSolid',
};

export function BroadcastStatusBadge({ status }: { status: BroadcastStatus }) {
  return (
    <Badge tone={TONE[status]}>
      {status === 'sent' && <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
      {status === 'sent' ? 'Done' : BROADCAST_STATUS_LABELS[status]}
    </Badge>
  );
}
