'use client';

// Use relative same-origin API paths by default for browser-side requests
// Server-side proxy routes forward to actual backend using BACKEND_URL env var
const API_BASE: string = '';

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
    const url = `${API_BASE}${path}`;
    
    // DEBUG: Log cross-origin requests
    if (typeof window !== 'undefined' && API_BASE && !API_BASE.includes(window.location.host ?? '')) {
      console.log(`[API] Cross-origin request: ${options.method || 'GET'} ${path} to ${API_BASE}`);
    }
    
    res = await fetch(url, {
      credentials: 'include',  // CRITICAL: Include cookies in cross-origin requests
      headers: isFormData 
        ? undefined 
        : { 
            'Content-Type': 'application/json', 
            ...(options.headers || {}) 
          },
      ...options,
    });
  } catch (err) {
    console.error(`[API] Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
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
    console.warn(`[API] ${res.status} ${code}: ${options.method || 'GET'} ${path}`);
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

export async function deleteJson<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' });
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // ignore network errors; redirect anyway
  }
  // Clear all React Query cached data so that a subsequent user who logs in
  // on the same browser tab cannot see the previous user's data during the
  // 30-second stale window before their own fetches complete.
  const { clearQueryCache } = await import('../providers/QueryProvider');
  clearQueryCache();
  window.location.href = '/';
}
