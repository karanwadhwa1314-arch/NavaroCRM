import { z } from 'zod';
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  PRIORITIES,
  TIMELINES,
  COMPANY_SIZES,
  CURRENCIES,
  USER_ADDABLE_ACTIVITY_TYPES,
} from '@/lib/constants';
import { MAX_IMPORT_ROWS } from '@/lib/csv';
import { emptyToUndefined, fallbackEnum, limitSchema, nullableObjectId, pageSchema, tagsSchema } from '@/lib/validation/common';

const estimatedBudgetSchema = z
  .object({
    min: z.coerce.number().min(0).optional(),
    max: z.coerce.number().min(0).optional(),
    currency: z.enum(CURRENCIES).default('USD'),
  })
  .refine((b) => b.min === undefined || b.max === undefined || b.min <= b.max, {
    message: 'Minimum budget must be less than or equal to maximum budget',
    path: ['min'],
  })
  .optional();

const baseLeadFields = {
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  company: z.string().trim().min(1).max(120),
  companySize: emptyToUndefined(z.enum(COMPANY_SIZES)),
  industry: z.string().trim().max(100).optional(),
  website: z.string().trim().max(200).optional(),
  source: emptyToUndefined(z.enum(LEAD_SOURCES)),
  sourceDetails: z.string().trim().max(200).optional(),
  estimatedBudget: estimatedBudgetSchema,
  expectedTimeline: emptyToUndefined(z.enum(TIMELINES)),
  assignedTo: nullableObjectId,
  requirements: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
  tags: tagsSchema,
  priority: emptyToUndefined(z.enum(PRIORITIES)),
};

export const createLeadSchema = z.object(baseLeadFields);
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z
  .object(
    Object.fromEntries(Object.entries(baseLeadFields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()]))
  )
  .strict();
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const updateLeadStageSchema = z
  .object({
    stage: z.enum(LEAD_STAGES),
    lostReason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.stage !== 'lost' || (v.lostReason && v.lostReason.length > 0), {
    message: 'A reason is required when marking a lead as lost',
    path: ['lostReason'],
  });
export type UpdateLeadStageInput = z.infer<typeof updateLeadStageSchema>;

export const addLeadActivitySchema = z.object({
  type: z.enum(USER_ADDABLE_ACTIVITY_TYPES),
  description: z.string().trim().min(1).max(2000),
});
export type AddLeadActivityInput = z.infer<typeof addLeadActivitySchema>;

export const leadListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema(),
  search: z.string().trim().max(100).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedTo: z.string().optional(),
  createdFrom: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  createdTo: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  converted: z.enum(['true', 'false']).optional(),
  sort: fallbackEnum(['createdAt', 'updatedAt', 'company', 'lastName', 'stage', 'priority'], 'createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;


/** One CSV row after client-side header mapping. Validated again here — the API is authoritative. */
export const importLeadRowSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().toLowerCase().email('Email is not valid'),
  phone: z.string().trim().min(1, 'Phone is required').max(30),
  company: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  website: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(100).optional(),
  source: z.string().trim().optional(),
  notes: z.string().trim().max(5000).optional(),
});
export type ImportLeadRow = z.infer<typeof importLeadRowSchema>;

export const importLeadsBodySchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1, 'The file has no data rows').max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} leads at a time`),
  dryRun: z.boolean().default(false),
});
export type ImportLeadsBody = z.infer<typeof importLeadsBodySchema>;
