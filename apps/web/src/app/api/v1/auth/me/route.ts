import { NextResponse } from 'next/server';

const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRY_WAIT_MS = 10_000;

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_WAIT_MS);
  }
  return Math.min(2000 * 2 ** attempt, MAX_RETRY_WAIT_MS);
}

async function proxyRequest(req: Request, method: 'GET' | 'PATCH') {
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const cookie = req.headers.get('cookie') || '';
  const forwardedFor = req.headers.get('x-forwarded-for');
  const headers: HeadersInit = {
    Cookie: cookie,
    ...(method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}),
  };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  const body = method === 'PATCH' ? await req.text() : undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);

    try {
      const resp = await fetch(`${backendUrl}/api/v1/auth/me`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (TRANSIENT_STATUSES.has(resp.status) && attempt < 2) {
        await resp.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, retryDelay(resp, attempt)));
        continue;
      }

      const data = await resp.text();
      if (TRANSIENT_STATUSES.has(resp.status)) {
        return NextResponse.json(
          { success: false, error: 'BACKEND_UNAVAILABLE' },
          { status: resp.status },
        );
      }

      return new NextResponse(data, {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort && attempt === 2) {
        return NextResponse.json(
          { success: false, error: 'BACKEND_TIMEOUT' },
          { status: 504 },
        );
      }
      if (!isAbort && attempt === 2) {
        return NextResponse.json(
          { success: false, error: 'BACKEND_UNAVAILABLE' },
          { status: 503 },
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return NextResponse.json(
    { success: false, error: 'BACKEND_UNAVAILABLE' },
    { status: 503 },
  );
}

export async function GET(req: Request) {
  return proxyRequest(req, 'GET');
}

export async function PATCH(req: Request) {
  return proxyRequest(req, 'PATCH');
}
