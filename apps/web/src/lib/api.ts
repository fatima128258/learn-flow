'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: isFormData ? undefined : { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR');
  }

  if (!res.ok) {
    let code = 'SERVER_ERROR';
    try {
      const body = await res.json();
      code = body?.error || body?.code || code;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code);
  }

  return res.json() as Promise<T>;
}

export async function getJson<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // ignore network errors; redirect anyway
  }
  window.location.href = '/';
}