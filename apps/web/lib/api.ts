import type { ApiError } from '@dyjext/shared';

/** Error thrown for non-2xx API responses, carrying the API's error code and message. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Call the API through the Next.js /api proxy. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      body?.error.code ?? 'unknown',
      body?.error.message ?? `Request failed (${response.status})`,
    );
  }
  return (await response.json()) as T;
}
