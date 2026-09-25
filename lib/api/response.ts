import { NextResponse } from 'next/server';

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function paginated<T>(items: T[], total: number, page: number, limit: number, status = 200) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagination: Pagination = {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
  return NextResponse.json({ success: true, data: items, pagination }, { status });
}

export function fail(message: string, status = 400, errors?: { field: string; message: string }[], extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, message, errors, ...extra }, { status });
}
