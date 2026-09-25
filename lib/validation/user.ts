import { z } from 'zod';
import { USER_ROLES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';

const passwordSchema = z.string().min(8).max(72);

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  role: z.enum(USER_ROLES).default('member'),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  phone: z.string().trim().max(30).optional(),
  department: z.string().trim().max(80).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(50).optional(),
    lastName: z.string().trim().min(1).max(50).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(30).optional(),
    department: z.string().trim().max(80).optional(),
    password: passwordSchema.optional(),
  })
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changeRoleSchema = z.object({ role: z.enum(USER_ROLES) });
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const setPermissionsSchema = z.object({ permissions: z.array(z.enum(PERMISSIONS)) });
export type SetPermissionsInput = z.infer<typeof setPermissionsSchema>;

export const setStatusSchema = z.object({ isActive: z.boolean() });
export type SetStatusInput = z.infer<typeof setStatusSchema>;

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sort: z.enum(['createdAt', 'firstName', 'lastName', 'lastLogin']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const assignableUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
});
