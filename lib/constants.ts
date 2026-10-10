export const LEAD_STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};
export const LEAD_STAGE_PIPELINE_ORDER: LeadStage[] = ['new', 'qualified', 'proposal', 'negotiation', 'won'];

/** An individual lead is a person (optionally at a company); a company lead is just an organisation, with no person's name. */
export const LEAD_TYPES = ['individual', 'company'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];
export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  individual: 'Individuals',
  company: 'Companies',
};

export const LEAD_SOURCES = [
  'website',
  'referral',
  'linkedin',
  'cold_call',
  'conference',
  'advertisement',
  'partner',
  'other',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  referral: 'Referral',
  linkedin: 'LinkedIn',
  cold_call: 'Cold call',
  conference: 'Conference',
  advertisement: 'Advertisement',
  partner: 'Partner',
  other: 'Other',
};

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TIMELINES = [
  'immediate',
  '1_month',
  '1_3_months',
  '3_6_months',
  '6_12_months',
  'not_sure',
] as const;
export type Timeline = (typeof TIMELINES)[number];
export const TIMELINE_LABELS: Record<Timeline, string> = {
  immediate: 'Immediate',
  '1_month': 'Within 1 month',
  '1_3_months': '1-3 months',
  '3_6_months': '3-6 months',
  '6_12_months': '6-12 months',
  not_sure: 'Not sure',
};

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'status_change', 'assignment'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  status_change: 'Stage change',
  assignment: 'Assignment',
};
export const USER_ADDABLE_ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting'] as const satisfies readonly ActivityType[];

export const CLIENT_STATUSES = ['prospect', 'active', 'inactive', 'churned'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
  churned: 'Churned',
};

export const CLIENT_TIERS = ['standard', 'premium', 'enterprise'] as const;
export type ClientTier = (typeof CLIENT_TIERS)[number];
export const CLIENT_TIER_LABELS: Record<ClientTier, string> = {
  standard: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

export const CLIENT_SOURCES = ['lead_conversion', 'direct', 'referral', 'partner', 'other'] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number];
export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  lead_conversion: 'Lead conversion',
  direct: 'Direct',
  referral: 'Referral',
  partner: 'Partner',
  other: 'Other',
};
/** Sources a user may pick when creating a client directly. `lead_conversion` is system-only. */
export const CLIENT_SOURCES_USER_SELECTABLE = ['direct', 'referral', 'partner', 'other'] as const satisfies readonly ClientSource[];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'CNY', 'SGD', 'JPY'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'USD';

export const USER_ROLES = ['superadmin', 'admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  member: 'Member',
};
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  superadmin: 'Full access, including user management',
  admin: 'Full access to leads, clients and projects',
  member: 'Leads, clients and projects; permissions adjustable',
};

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'failed_login',
  'status_change',
  'assignment_change',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITIES = ['user', 'lead', 'client', 'auth', 'broadcast', 'project'] as const;

export const BROADCAST_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];
export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const PROJECT_STATUSES = ['planning', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In progress',
  on_hold: 'On hold',
  review: 'Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
/** Statuses whose projects count towards the health summary (work is still live). */
export const PROJECT_LIVE_STATUSES: ProjectStatus[] = ['planning', 'in_progress', 'review'];

/** Roles a person can hold on a project team (trade-oriented; Flare's were software-delivery roles). */
export const PROJECT_TEAM_ROLES = [
  'project_manager',
  'coordinator',
  'sourcing',
  'logistics',
  'compliance',
  'finance',
  'consultant',
] as const;
export type ProjectTeamRole = (typeof PROJECT_TEAM_ROLES)[number];
export const PROJECT_TEAM_ROLE_LABELS: Record<ProjectTeamRole, string> = {
  project_manager: 'Project manager',
  coordinator: 'Coordinator',
  sourcing: 'Sourcing',
  logistics: 'Logistics',
  compliance: 'Compliance',
  finance: 'Finance',
  consultant: 'Consultant',
};

export const CARD_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];
export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const CARD_RECURRENCE_TYPES = ['none', 'daily', 'weekly', 'monthly'] as const;
export type CardRecurrenceType = (typeof CARD_RECURRENCE_TYPES)[number];
export const CARD_RECURRENCE_LABELS: Record<CardRecurrenceType, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** Done cards are removed this many days after completion (nightly job). */
export const DONE_CARD_RETENTION_DAYS = 10;

export const PROJECT_HEALTH_LEVELS = ['perfect', 'good', 'average', 'critical'] as const;
export type ProjectHealthLevel = (typeof PROJECT_HEALTH_LEVELS)[number];
export const PROJECT_HEALTH_LABELS: Record<ProjectHealthLevel, string> = {
  perfect: 'Perfect',
  good: 'Good',
  average: 'Average',
  critical: 'Critical',
};
