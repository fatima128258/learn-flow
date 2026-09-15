import { NextRequest, NextResponse } from 'next/server';

const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const BACKEND_TIMEOUT_MS = 30_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const backendUrl = process.env.BACKEND_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'https://learn-flow-1-1gl3.onrender.com';
    const { path = [] } = await context.params;
    const incomingUrl = new URL(request.url);
    const query = incomingUrl.searchParams.toString();
    const forwardUrl = `${backendUrl}/api/v1/instructor/${path.join('/')}${query ? `?${query}` : ''}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
      try {
        const response = await fetch(forwardUrl, {
          headers: {
            Cookie: request.headers.get('cookie') || '',
            'X-Organization-Id': request.headers.get('x-organization-id') || '',
          },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (TRANSIENT_STATUSES.has(response.status) && attempt < 2) {
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }
        const body = await response.text();
        if (TRANSIENT_STATUSES.has(response.status)) {
          return NextResponse.json(
            { success: false, error: 'BACKEND_UNAVAILABLE' },
            { status: response.status },
          );
        }
        try {
          return NextResponse.json(JSON.parse(body), { status: response.status });
        } catch {
          return NextResponse.json(
            { success: false, error: 'BACKEND_INVALID_RESPONSE' },
            { status: 502 },
          );
        }
      } catch (error) {
        if (attempt === 2) {
          const timedOut = error instanceof Error && error.name === 'AbortError';
          return NextResponse.json(
            { success: false, error: timedOut ? 'BACKEND_TIMEOUT' : 'BACKEND_UNAVAILABLE' },
            { status: timedOut ? 504 : 503 },
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
    return NextResponse.json({ success: false, error: 'BACKEND_UNAVAILABLE' }, { status: 503 });
  } catch {
    return NextResponse.json({ success: false, error: 'BACKEND_UNAVAILABLE' }, { status: 502 });
  }
}
