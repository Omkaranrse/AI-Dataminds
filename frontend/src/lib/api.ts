import { getSession } from "next-auth/react";

export const publicApi = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const serverApi = process.env.BACKEND_URL
  ? `${process.env.BACKEND_URL}/api/v1`
  : publicApi;

export type ApiValidationError = {
  loc?: Array<string | number>;
  msg: string;
  type?: string;
};

export type ApiErrorResponse = {
  detail?: string | ApiValidationError[];
  message?: string;
};

export class ApiError extends Error {
  status: number;
  data: ApiErrorResponse;

  constructor(status: number, message: string, data: ApiErrorResponse = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function parseErrorMessage(status: number, data: ApiErrorResponse): string {
  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail;
  }
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail[0]?.msg ?? `Request failed with status ${status}`;
  }
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  return `Request failed with status ${status}`;
}

/**
 * Basic fetch wrapper for public / unauthenticated backend endpoints.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${publicApi}${normalizedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    const message = parseErrorMessage(response.status, errorData);
    throw new ApiError(response.status, message, errorData);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Authenticated API client for React Client Components.
 * Automatically injects the session's Bearer access token.
 */
export async function clientApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession();
  const token = session?.accessToken;

  return api<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Authenticated API client for React Server Components, Server Actions, and Route Handlers.
 * Uses auth() to retrieve the session and connects using serverApi.
 */
export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { auth } = await import("@/auth");
  const session = await auth();
  const token = session?.accessToken;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${serverApi}${normalizedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: init?.cache ?? "no-store",
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    const message = parseErrorMessage(response.status, errorData);
    throw new ApiError(response.status, message, errorData);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}
