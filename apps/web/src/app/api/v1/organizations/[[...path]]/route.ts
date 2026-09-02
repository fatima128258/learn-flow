import { NextRequest, NextResponse } from 'next/server';

async function proxyRequest(
  req: NextRequest,
  method: string,
  pathSegments: string[]
) {
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const path = pathSegments.join('/');
  const cookie = req.headers.get('cookie') || '';
  
  // Preserve query parameters
  const url = new URL(req.url);
  const queryString = url.search;
  
  let body: string | undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    body = await req.text();
  }
  
  try {
    const resp = await fetch(
      `${backendUrl}/api/v1/organizations/${path}${queryString}`,
      {
        method,
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: body || undefined,
      }
    );
    
    const data = await resp.text();
    return new NextResponse(data, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
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
