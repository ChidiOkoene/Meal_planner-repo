'use client';

import { useAuth } from '@clerk/nextjs';
import type { ApiError } from '@dyjext/shared';
import { useCallback } from 'react';

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

/**
 * Call the API through the Next.js /api proxy, as the signed-in user. The session token goes in
 * the Authorization header; the API never accepts cookies, so other sites can't act as the user.
 */
export function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      const response = await fetch(`/api${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          (ApiError & { error: { code: string | { code?: string } } }) | null;
        throw new ApiRequestError(
          response.status,
          typeof body?.error.code === 'string' ? body.error.code : 'unknown',
          body?.error.message ?? `Request failed (${response.status})`,
        );
      }
      return (await response.json()) as T;
    },
    [getToken],
  );
}

/** The signed-in user, as the API sees them (GET /v1/me). */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  staffRoles: ('dietitian' | 'ops' | 'admin')[];
  staff: { twoFactorEnabled: boolean; unlocked: boolean } | null;
  households: { id: string; name: string; status: string; role: string }[];
}
