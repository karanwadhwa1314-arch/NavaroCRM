import { Badge, type BadgeTone } from '@/components/ui/Badge';
import {
  LEAD_STAGE_LABELS,
  PRIORITY_LABELS,
  CLIENT_STATUS_LABELS,
  CLIENT_TIER_LABELS,
  PROJECT_STATUS_LABELS,
  CARD_STATUS_LABELS,
  type ProjectStatus,
  type CardStatus,
  type LeadStage,
  type Priority,
  type ClientStatus,
  type ClientTier,
} from '@/lib/constants';

const LEAD_STAGE_TONE: Record<LeadStage, BadgeTone> = {
  new: 'lavenderSolid',
  qualified: 'turquoiseSolid',
  proposal: 'yellowSolid',
  negotiation: 'yellowSolid',
  won: 'green',
  lost: 'dangerSolid',
};

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  low: 'outline',
  medium: 'neutral',
  high: 'yellowSolid',
  urgent: 'dangerSolid',
};

const CLIENT_STATUS_TONE: Record<ClientStatus, BadgeTone> = {
  prospect: 'lavenderSolid',
  active: 'turquoiseSolid',
  inactive: 'outline',
  churned: 'dangerSolid',
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

const PROJECT_STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  planning: 'lavenderSolid',
  in_progress: 'turquoiseSolid',
  on_hold: 'yellowSolid',
  review: 'lavender',
  completed: 'green',
  cancelled: 'outline',
};

const CARD_STATUS_TONE: Record<CardStatus, BadgeTone> = {
  todo: 'neutral',
  in_progress: 'turquoiseSolid',
  done: 'green',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={PROJECT_STATUS_TONE[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

export function CardStatusBadge({ status }: { status: CardStatus }) {
  return <Badge tone={CARD_STATUS_TONE[status]}>{CARD_STATUS_LABELS[status]}</Badge>;
}
