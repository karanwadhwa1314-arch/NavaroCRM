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

/**
 * A sort-field whitelist that never fails validation: an unknown or missing
 * value silently falls back to `fallback` instead of 400ing the request.
 */
export function fallbackEnum<T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.preprocess(
    (v) => (typeof v === 'string' && (values as readonly string[]).includes(v) ? v : fallback),
    z.enum(values)
  );
}

/** `page` never 400s: non-numeric or below-1 values just clamp to 1. */
export const pageSchema = z.preprocess((v) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}, z.number().int().min(1)).default(1);

/** `limit` never 400s: it's clamped into [1, max] instead of rejecting out-of-range values (defect #5). */
export function limitSchema(max = 100, fallback = 20) {
  return z.preprocess((v) => {
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(1, n));
  }, z.number().int().min(1).max(max)).default(fallback);
}
