import { NextRequest, NextResponse } from 'next/server';

const STUDENT_TASK_TIMEOUT_MS = 60000;
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRY_WAIT_MS = 10_000;

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_WAIT_MS);
  }
  return Math.min(2000 * 2 ** attempt, MAX_RETRY_WAIT_MS);
}

function getBackendUrl() {
  return process.env.BACKEND_URL
    || process.env.NEXT_PUBLIC_BACKEND_URL
    || 'https://learn-flow-1-1gl3.onrender.com';
}

async function proxyRequest(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
) {
  const backendUrl = getBackendUrl();
  const url = new URL(request.url);
  const queryString = url.searchParams.toString();
  const forwardUrl = `${backendUrl}/api/v1/student/${path}${queryString ? `?${queryString}` : ''}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STUDENT_TASK_TIMEOUT_MS);
  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const requestController = attempt === 0 ? controller : new AbortController();
      const requestTimeoutId = attempt === 0
        ? timeoutId
        : setTimeout(() => requestController.abort(), STUDENT_TASK_TIMEOUT_MS);
      try {
        const fetchedResponse = await fetch(forwardUrl, {
          method,
          headers: {
            Cookie: request.headers.get('cookie') || '',
            'Content-Type': 'application/json',
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: requestController.signal,
        });
        response = fetchedResponse;
        if (!TRANSIENT_STATUSES.has(fetchedResponse.status) || method !== 'GET' || attempt === 2) break;
        await fetchedResponse.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, retryDelay(fetchedResponse, attempt)));
      } finally {
        if (attempt > 0) clearTimeout(requestTimeoutId);
      }
    }
    if (!response) {
      return NextResponse.json({ success: false, error: 'BACKEND_UNAVAILABLE' }, { status: 503 });
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: response.status });
    } catch {
      return NextResponse.json(
        { success: false, error: 'BACKEND_INVALID_RESPONSE' },
        { status: response.ok ? 502 : response.status },
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'BACKEND_TIMEOUT' }, { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path: pathArray = [] } = await context.params;
    return proxyRequest(request, 'GET', pathArray.join('/'));
  } catch (error) {
    console.error('Student proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch student tasks' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path: pathArray = [] } = await context.params;
    const body = await request.json().catch(() => undefined);
    return proxyRequest(request, 'POST', pathArray.join('/'), body);
  } catch (error) {
    console.error('Student proxy error:', error);
    return NextResponse.json({ error: 'Failed to create student task' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path: pathArray = [] } = await context.params;
    const body = await request.json().catch(() => undefined);
    return proxyRequest(request, 'PATCH', pathArray.join('/'), body);
  } catch (error) {
    console.error('Student proxy error:', error);
    return NextResponse.json({ error: 'Failed to update student task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path: pathArray = [] } = await context.params;
    return proxyRequest(request, 'DELETE', pathArray.join('/'));
  } catch (error) {
    console.error('Student proxy error:', error);
    return NextResponse.json({ error: 'Failed to delete student task' }, { status: 500 });
  }
}
