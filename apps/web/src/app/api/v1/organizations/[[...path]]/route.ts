import { NextRequest, NextResponse } from 'next/server';

const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const BACKEND_TIMEOUT_MS = 20000;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function proxyRequest(
  req: NextRequest,
  method: string,
  pathSegments: string[]
) {
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const path = pathSegments.join('/');
  const cookie = req.headers.get('cookie') || '';
  const retryableProgressRequest = method === 'POST' && path.endsWith('/progress');
  
  // Preserve query parameters
  const url = new URL(req.url);
  const queryString = url.search;
  
  let body: string | undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    body = await req.text();
  }
  
  try {
    let resp: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
      try {
        resp = await fetch(
          `${backendUrl}/api/v1/organizations/${path}${queryString}`,
          {
            method,
            headers: {
              Cookie: cookie,
              'Content-Type': 'application/json',
            },
            body: body || undefined,
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (
        !TRANSIENT_STATUSES.has(resp.status) ||
        (!retryableProgressRequest && method !== 'GET') ||
        attempt === 2
      ) {
        break;
      }

      await resp.body?.cancel();
      await wait(250 * (attempt + 1));
    }

    if (!resp) {
      throw new Error('Organization proxy did not receive a response');
    }
    
    const data = await resp.text();
    if (TRANSIENT_STATUSES.has(resp.status)) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'BACKEND_UNAVAILABLE' }),
        { status: resp.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new NextResponse(data, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'BACKEND_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new NextResponse(
      JSON.stringify({ success: false, error: 'PROXY_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxyRequest(req, 'GET', path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxyRequest(req, 'POST', path);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxyRequest(req, 'PATCH', path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxyRequest(req, 'DELETE', path);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxyRequest(req, 'PUT', path);
}
