'use client';

import toast from 'react-hot-toast';

export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];
  data?: unknown;

  constructor(status: number, message: string, errors?: { field: string; message: string }[], data?: unknown) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json: { success: boolean; data?: T; message?: string; errors?: { field: string; message: string }[] } | null =
    null;
  try {
    json = await res.json();
  } catch {
    // no body
  }

  if (!res.ok || !json || json.success === false) {
    const message = json?.message ?? 'Something went wrong';

    if (res.status === 401 && path !== '/api/auth/login') {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/';
      if (typeof window !== 'undefined') {
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      }
    } else if (res.status === 403) {
      toast.error("You don't have permission to do that");
    } else if (res.status >= 500) {
      toast.error('Server error. Please try again.');
    }

    throw new ApiError(res.status, message, json?.errors, json);
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
