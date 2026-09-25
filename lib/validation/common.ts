import { z } from 'zod';
import mongoose from 'mongoose';

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

/** Empty-string enum fields from HTML forms become undefined instead of failing validation. */
export function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
}

/** `assignedTo: ''` etc. should cast to null, not attempt an ObjectId cast (defect #21). */
export const nullableObjectId = z.preprocess((v) => (v === '' ? null : v), objectId.nullable().optional());

export const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((tags) => Array.from(new Set(tags)))
  .optional();

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});
