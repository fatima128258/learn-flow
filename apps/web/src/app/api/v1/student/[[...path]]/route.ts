import { NextRequest, NextResponse } from 'next/server';

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

  const response = await fetch(forwardUrl, {
    method,
    headers: {
      Cookie: request.headers.get('cookie') || '',
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: 'BACKEND_INVALID_RESPONSE' }, { status: 502 });
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
