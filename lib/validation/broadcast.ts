import { z } from 'zod';
import { htmlToText, sanitizeBroadcastHtml } from '@/lib/broadcast-email';
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from '@/lib/broadcast-attachment-rules';

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

/**
 * An attachment is either an already-saved one to keep (`id`) or a new upload (`filename` + base64 `data`).
 * Only the shape and size are checked here; the type/content checks happen in the service, which
 * has the bytes decoded (see prepareUploads in services/broadcasts.ts).
 */
const MAX_BASE64_CHARS = Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 + 8;
const attachmentSchema = z.union([
  z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid attachment') }).strict(),
  z
    .object({
      filename: z.string().min(1, 'Each attachment needs a file name').max(300),
      data: z.string().min(1, 'An attachment is empty').max(MAX_BASE64_CHARS, 'Each file must be 400 KB or smaller'),
    })
    .strict(),
]);
const attachmentsSchema = z.array(attachmentSchema).max(MAX_ATTACHMENTS, `You can attach up to ${MAX_ATTACHMENTS} files`);
export type AttachmentInput = z.infer<typeof attachmentSchema>;

export const createBroadcastSchema = z.object({
  subject: text('Subject', 300),
  preview: text('Preview', 300),
  content: contentSchema,
  /** Omit/null to save as a draft. */
  scheduledAt: scheduledAtSchema,
  attachments: attachmentsSchema.optional(),
});
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;

export const updateBroadcastSchema = z
  .object({
    subject: text('Subject', 300).optional(),
    preview: text('Preview', 300).optional(),
    content: contentSchema.optional(),
    scheduledAt: scheduledAtSchema,
    /** The complete desired list on update: ids to keep plus new uploads. Omit to leave attachments untouched. */
    attachments: attachmentsSchema.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');
export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>;
