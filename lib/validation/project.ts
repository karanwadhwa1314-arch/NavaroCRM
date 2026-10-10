import { z } from 'zod';
import { CARD_RECURRENCE_TYPES, CARD_STATUSES, PRIORITIES, PROJECT_STATUSES, PROJECT_TEAM_ROLES } from '@/lib/constants';
import { emptyToUndefined, limitSchema, nullableObjectId, objectId, pageSchema, tagsSchema } from '@/lib/validation/common';

/** '' (an empty date input) means "no date"; anything else must parse as a real date. */
const nullableDate = z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullable().optional());
/** A bare `YYYY-MM-DD` is pinned to noon UTC so it shows as the same calendar day in every timezone. */
const requiredDate = z.preprocess(
  (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00.000Z` : v),
  z.coerce.date({ error: 'Enter a valid date' })
);

export const createProjectSchema = z.object({
  client: objectId,
  motive: z.string().trim().min(1, 'Motive is required').max(100),
  description: z.string().trim().max(5000).optional(),
  startDate: requiredDate,
  priority: emptyToUndefined(z.enum(PRIORITIES)),
  projectManager: nullableObjectId,
  notes: z.string().trim().max(5000).optional(),
  tags: tagsSchema,
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    motive: z.string().trim().min(1, 'Motive is required').max(100).optional(),
    description: z.string().trim().max(5000).optional(),
    startDate: requiredDate.optional(),
    status: emptyToUndefined(z.enum(PROJECT_STATUSES)),
    priority: emptyToUndefined(z.enum(PRIORITIES)),
    projectManager: nullableObjectId,
    notes: z.string().trim().max(5000).optional(),
    tags: tagsSchema,
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, 'At least one field is required');
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema(),
  search: z.string().trim().max(100).optional(),
  status: emptyToUndefined(z.enum(PROJECT_STATUSES)),
  priority: emptyToUndefined(z.enum(PRIORITIES)),
  client: emptyToUndefined(objectId),
  projectManager: z.string().optional(),
  teamMember: z.string().optional(),
  /** Omitted ⇒ least healthy projects first (computed from cards), as in the Flare reference. */
  sort: z.preprocess(
    (v) => (typeof v === 'string' && ['createdAt', 'updatedAt', 'name', 'status', 'priority', 'startDate'].includes(v) ? v : undefined),
    z.enum(['createdAt', 'updatedAt', 'name', 'status', 'priority', 'startDate']).optional()
  ),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const addTeamMemberSchema = z.object({
  user: objectId,
  role: z.enum(PROJECT_TEAM_ROLES),
});
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;

export const updateTeamMemberSchema = z.object({ role: z.enum(PROJECT_TEAM_ROLES) }).strict();
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

const fileLinkSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    if (v === '') return true;
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'File link must be a valid http(s) URL');

const recurrenceSchema = z
  .object({
    type: z.enum(CARD_RECURRENCE_TYPES),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.type === 'weekly' && !(r.daysOfWeek && r.daysOfWeek.length > 0)) {
      ctx.addIssue({ code: 'custom', path: ['daysOfWeek'], message: 'Select at least one weekday for weekly recurrence' });
    }
    if (r.type === 'monthly' && !r.dayOfMonth) {
      ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: 'Day of month is required for monthly recurrence' });
    }
  });

export const createCardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
  fileLink: fileLinkSchema.optional(),
  status: emptyToUndefined(z.enum(CARD_STATUSES)),
  assignees: z.array(objectId).min(1, 'Select at least one team member').max(50),
  deadline: nullableDate,
  recurrence: recurrenceSchema.optional(),
});
export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
    fileLink: fileLinkSchema.optional(),
    status: emptyToUndefined(z.enum(CARD_STATUSES)),
    assignees: z.array(objectId).max(50).optional(),
    deadline: nullableDate,
    recurrence: recurrenceSchema.optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, 'At least one field is required');
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
