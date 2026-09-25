import { z } from 'zod';
import { CLIENT_STATUSES, CLIENT_TIERS, CLIENT_SOURCES_USER_SELECTABLE, COMPANY_SIZES, CURRENCIES } from '@/lib/constants';
import { emptyToUndefined, fallbackEnum, limitSchema, nullableObjectId, pageSchema, tagsSchema } from '@/lib/validation/common';

const addressSchema = z
  .object({
    street: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    zipCode: z.string().trim().max(20).optional(),
  })
  .optional();

const billingAddressSchema = z
  .object({
    street: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    zipCode: z.string().trim().max(20).optional(),
    sameAsAddress: z.boolean().default(true),
  })
  .optional();

export const clientContactSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  isPrimary: z.boolean().optional(),
});
export type ClientContactInput = z.infer<typeof clientContactSchema>;

export const clientContactUpdateSchema = clientContactSchema.partial().strict();
export type ClientContactUpdateInput = z.infer<typeof clientContactUpdateSchema>;

const optionalContactSchema = z
  .object({
    firstName: z.string().trim().max(50).optional(),
    lastName: z.string().trim().max(50).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(30).optional(),
    jobTitle: z.string().trim().max(100).optional(),
  })
  .optional()
  .refine(
    (c) => {
      if (!c) return true;
      const anyFilled = c.firstName || c.lastName || c.email || c.phone || c.jobTitle;
      if (!anyFilled) return true;
      return Boolean(c.firstName && c.lastName && c.email);
    },
    { message: 'First name, last name and email are required for the primary contact' }
  );

export const createClientSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(100).optional(),
  companySize: emptyToUndefined(z.enum(COMPANY_SIZES)),
  website: z.string().trim().max(200).optional(),
  address: addressSchema,
  billingAddress: billingAddressSchema,
  contact: optionalContactSchema,
  accountManager: nullableObjectId,
  status: emptyToUndefined(z.enum(CLIENT_STATUSES)),
  tier: emptyToUndefined(z.enum(CLIENT_TIERS)),
  paymentTerms: z.coerce.number().int().min(0).optional(),
  taxId: z.string().trim().max(60).optional(),
  currency: z.enum(CURRENCIES).optional(),
  source: emptyToUndefined(z.enum(CLIENT_SOURCES_USER_SELECTABLE)),
  notes: z.string().trim().max(5000).optional(),
  tags: tagsSchema,
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z
  .object({
    companyName: z.string().trim().min(1).max(120).optional(),
    displayName: z.string().trim().max(120).optional(),
    industry: z.string().trim().max(100).optional(),
    companySize: emptyToUndefined(z.enum(COMPANY_SIZES)),
    website: z.string().trim().max(200).optional(),
    address: addressSchema,
    billingAddress: billingAddressSchema,
    accountManager: nullableObjectId,
    status: emptyToUndefined(z.enum(CLIENT_STATUSES)),
    tier: emptyToUndefined(z.enum(CLIENT_TIERS)),
    paymentTerms: z.coerce.number().int().min(0).optional(),
    taxId: z.string().trim().max(60).optional(),
    currency: z.enum(CURRENCIES).optional(),
    source: emptyToUndefined(z.enum(CLIENT_SOURCES_USER_SELECTABLE)),
    notes: z.string().trim().max(5000).optional(),
    tags: tagsSchema,
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, 'At least one field is required');
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema(),
  search: z.string().trim().max(100).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  tier: z.enum(CLIENT_TIERS).optional(),
  accountManager: z.string().optional(),
  industry: z.string().trim().max(100).optional(),
  sort: fallbackEnum(['createdAt', 'updatedAt', 'companyName', 'status', 'tier'], 'createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
