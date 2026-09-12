'use client';

import { CSRF_HEADER } from '@/lib/client/constants';

/**
 * Browser-side API client.
 *
 * Every mutation carries the custom header the server requires, and every
 * failure comes back as an `Error` with the server's `code` attached so call
 * sites can branch on `ALREADY_PLAYED` rather than on message text.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER]: '1' },
    body: JSON.stringify(body ?? {}),
    credentials: 'same-origin',
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new ApiError(
      typeof payload.error === 'string' ? payload.error : 'Request failed.',
      typeof payload.code === 'string' ? payload.code : 'UNKNOWN',
      response.status,
    );
  }
  return payload as T;
}
