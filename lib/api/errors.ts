export class AppError extends Error {
  status: number;
  errors?: { field: string; message: string }[];
  extra?: Record<string, unknown>;

  constructor(status: number, message: string, opts?: { errors?: { field: string; message: string }[]; extra?: Record<string, unknown> }) {
    super(message);
    this.status = status;
    this.errors = opts?.errors;
    this.extra = opts?.extra;
  }
}

export function unauthorized(message = 'Not authenticated') {
  return new AppError(401, message);
}

export function forbidden(message = "You don't have permission to do that") {
  return new AppError(403, message);
}

export function notFound(message = 'Resource not found') {
  return new AppError(404, message);
}

export function conflict(message: string, extra?: Record<string, unknown>) {
  return new AppError(409, message, { extra });
}

export function badRequest(message: string, errors?: { field: string; message: string }[]) {
  return new AppError(400, message, { errors });
}
