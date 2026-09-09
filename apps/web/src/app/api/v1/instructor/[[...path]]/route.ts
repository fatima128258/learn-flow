import { NextRequest, NextResponse } from 'next/server';

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
    const response = await fetch(
      `${backendUrl}/api/v1/instructor/${path.join('/')}${query ? `?${query}` : ''}`,
      {
        headers: {
          Cookie: request.headers.get('cookie') || '',
          'X-Organization-Id': request.headers.get('x-organization-id') || '',
        },
        cache: 'no-store',
      },
    );
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'BACKEND_UNAVAILABLE' }, { status: 502 });
  }
}
