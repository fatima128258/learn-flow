import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const cookie = req.headers.get('cookie') || '';
  const forwardedFor = req.headers.get('x-forwarded-for');
  const headers: HeadersInit = { Cookie: cookie };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  const transientStatuses = new Set([502, 503, 504]);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);

    try {
      const resp = await fetch(`${backendUrl}/api/v1/auth/me`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (transientStatuses.has(resp.status) && attempt < 2) {
        await resp.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }

      const data = await resp.text();
      if (transientStatuses.has(resp.status)) {
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
