import { Badge, type BadgeTone } from '@/components/ui/Badge';
import {
  LEAD_STAGE_LABELS,
  PRIORITY_LABELS,
  CLIENT_STATUS_LABELS,
  CLIENT_TIER_LABELS,
  type LeadStage,
  type Priority,
  type ClientStatus,
  type ClientTier,
} from '@/lib/constants';

const LEAD_STAGE_TONE: Record<LeadStage, BadgeTone> = {
  new: 'lavender',
  qualified: 'turquoise',
  proposal: 'yellow',
  negotiation: 'yellow',
  won: 'green',
  lost: 'danger',
};

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  low: 'neutral',
  medium: 'lavender',
  high: 'yellow',
  urgent: 'danger',
};

const CLIENT_STATUS_TONE: Record<ClientStatus, BadgeTone> = {
  prospect: 'lavender',
  active: 'turquoise',
  inactive: 'neutral',
  churned: 'danger',
};

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return <Badge tone={LEAD_STAGE_TONE[stage]}>{LEAD_STAGE_LABELS[stage]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge tone={CLIENT_STATUS_TONE[status]}>{CLIENT_STATUS_LABELS[status]}</Badge>;
}

export function ClientTierBadge({ tier }: { tier: ClientTier }) {
  return <Badge tone="outline">{CLIENT_TIER_LABELS[tier]}</Badge>;
}
