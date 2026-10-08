import { z } from 'zod';
import { htmlToText, sanitizeBroadcastHtml } from '@/lib/broadcast-email';

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** Editor HTML is sanitised here, so nothing unsanitised ever reaches the database or an email. */
const contentSchema = z
  .string({ error: 'Email content is required' })
  .max(200_000, 'Email content is too long')
  .transform((html) => sanitizeBroadcastHtml(html))
  .refine((html) => htmlToText(html).length > 0, 'Email content is required');

const scheduledAtSchema = z
  .string()
  .datetime({ offset: true, message: 'Enter a valid date and time' })
  .transform((s) => new Date(s))
  .nullable()
  .optional();

export const createBroadcastSchema = z.object({
  subject: text('Subject', 300),
  preview: text('Preview', 300),
  content: contentSchema,
  /** Omit/null to save as a draft. */
  scheduledAt: scheduledAtSchema,
});
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;

export const updateBroadcastSchema = z
  .object({
    subject: text('Subject', 300).optional(),
    preview: text('Preview', 300).optional(),
    content: contentSchema.optional(),
    scheduledAt: scheduledAtSchema,
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');
export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>;
