import 'server-only';
import { type NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import mongoose from 'mongoose';
import { requireApiUser, requireApiPermission, type SessionUser } from '@/lib/auth/session';
import type { Permission } from '@/lib/permissions';
import { AppError } from './errors';
import { fail } from './response';

interface RouteContext {
  params: Record<string, string>;
}

interface WithRouteOptions<TBody, TQuery> {
  permission?: Permission | Permission[];
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  /** Route params to validate as Mongo ObjectIds. Defaults to every param present. */
  idParams?: string[];
  /** Set false for endpoints reachable without a session (only /api/auth/login today). */
  requireAuth?: boolean;
}

type Handler<TBody, TQuery> = (args: {
  req: NextRequest;
  /** Undefined only when the route sets `requireAuth: false`. */
  actor: SessionUser;
  body: TBody;
  query: TQuery;
  params: Record<string, string>;
}) => Promise<Response>;

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function withRoute<TBody = undefined, TQuery = undefined>(
  options: WithRouteOptions<TBody, TQuery>,
  handler: Handler<TBody, TQuery>
) {
  return async (req: NextRequest, context: RouteContext) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        const contentType = req.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          throw new AppError(400, 'Content-Type must be application/json');
        }
        const host = req.headers.get('host');
        const originHost = hostOf(req.headers.get('origin')) ?? hostOf(req.headers.get('referer'));
        if (host && originHost && originHost !== host) {
          throw new AppError(403, 'Cross-origin request blocked');
        }
      }

      const actor =
        options.requireAuth === false
          ? (undefined as unknown as SessionUser)
          : options.permission
            ? await requireApiPermission(...(Array.isArray(options.permission) ? options.permission : [options.permission]))
            : await requireApiUser();

      const params = context.params ?? {};
      const idKeys = options.idParams ?? Object.keys(params);
      for (const key of idKeys) {
        const value = params[key];
        if (value !== undefined && !mongoose.isValidObjectId(value)) {
          throw new AppError(404, 'Resource not found');
        }
      }

      let body = undefined as TBody;
      if (options.body) {
        const json = await req.json().catch(() => ({}));
        const parsed = options.body.safeParse(json);
        if (!parsed.success) {
          throw new AppError(400, 'Validation failed', {
            errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
        }
        body = parsed.data;
      }

      let query = undefined as TQuery;
      if (options.query) {
        const url = new URL(req.url);
        const parsed = options.query.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          throw new AppError(400, 'Validation failed', {
            errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
        }
        query = parsed.data;
      }

      return await handler({ req, actor, body, query, params });
    } catch (err) {
      return mapError(err);
    }
  };
}

function mapError(err: unknown): Response {
  if (err instanceof AppError) {
    return fail(err.message, err.status, err.errors, err.extra);
  }

  if (isMongoDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'Field';
    return fail(`${capitalize(field)} already exists`, 409);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return fail('Validation failed', 400, errors);
  }

  if (err instanceof mongoose.Error.CastError) {
    return fail('Resource not found', 404);
  }

  console.error('Unhandled API error:', err);
  return fail('Something went wrong', 500);
}

interface MongoDuplicateKeyError {
  code: number;
  keyValue?: Record<string, unknown>;
}

function isMongoDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 11000;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
