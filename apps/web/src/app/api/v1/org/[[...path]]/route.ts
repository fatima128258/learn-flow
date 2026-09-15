import { NextRequest, NextResponse } from 'next/server';

const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const BACKEND_TIMEOUT_MS = 30_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { params } = context;
  try {
    const backendUrl = process.env.BACKEND_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'https://learn-flow-1-1gl3.onrender.com';
    const { path: pathArray = [] } = await params;
    
    if (!backendUrl) {
      return NextResponse.json(
        { error: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    const path = pathArray.join('/');
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const forwardUrl = `${backendUrl}/api/v1/org/${path}${queryString ? '?' + queryString : ''}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
      try {
        const response = await fetch(forwardUrl, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || '',
            'X-Organization-Id': request.headers.get('X-Organization-Id') || '',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          cache: 'no-store',
        });

        if (TRANSIENT_STATUSES.has(response.status) && attempt < 2) {
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }

        const text = await response.text();
        if (TRANSIENT_STATUSES.has(response.status)) {
          return NextResponse.json(
            { success: false, error: 'BACKEND_UNAVAILABLE' },
            { status: response.status },
          );
        }

        try {
          return NextResponse.json(JSON.parse(text), { status: response.status });
        } catch {
          return NextResponse.json(
            { success: false, error: 'BACKEND_INVALID_RESPONSE' },
            { status: 502 },
          );
        }
      } catch (error) {
        if (attempt === 2) {
          return NextResponse.json(
            { success: false, error: error instanceof Error && error.name === 'AbortError' ? 'BACKEND_TIMEOUT' : 'BACKEND_UNAVAILABLE' },
            { status: error instanceof Error && error.name === 'AbortError' ? 504 : 503 },
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return NextResponse.json({ success: false, error: 'BACKEND_UNAVAILABLE' }, { status: 503 });
  } catch (error) {
    console.error('Org proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { params } = context;
  try {
    const backendUrl = process.env.BACKEND_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'https://learn-flow-1-1gl3.onrender.com';
    const { path: pathArray = [] } = await params;
    
    if (!backendUrl) {
      return NextResponse.json(
        { error: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    const path = pathArray.join('/');
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const forwardUrl = `${backendUrl}/api/v1/org/${path}${queryString ? '?' + queryString : ''}`;

    const body = await request.json().catch(() => null);

    const response = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'X-Organization-Id': request.headers.get('X-Organization-Id') || '',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Set-Cookie': response.headers.get('Set-Cookie') || '',
      },
    });
  } catch (error) {
    console.error('Org proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to post organization data' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { params } = context;
  try {
    const backendUrl = process.env.BACKEND_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'https://learn-flow-1-1gl3.onrender.com';
    const { path: pathArray = [] } = await params;
    
    if (!backendUrl) {
      return NextResponse.json(
        { error: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    const path = pathArray.join('/');
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const forwardUrl = `${backendUrl}/api/v1/org/${path}${queryString ? '?' + queryString : ''}`;

    const body = await request.json().catch(() => null);

    const response = await fetch(forwardUrl, {
      method: 'PATCH',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'X-Organization-Id': request.headers.get('X-Organization-Id') || '',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Set-Cookie': response.headers.get('Set-Cookie') || '',
      },
    });
  } catch (error) {
    console.error('Org proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to patch organization data' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { params } = context;
  try {
    const backendUrl = process.env.BACKEND_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'https://learn-flow-1-1gl3.onrender.com';
    const { path: pathArray = [] } = await params;
    
    if (!backendUrl) {
      return NextResponse.json(
        { error: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    const path = pathArray.join('/');
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const forwardUrl = `${backendUrl}/api/v1/org/${path}${queryString ? '?' + queryString : ''}`;

    const response = await fetch(forwardUrl, {
      method: 'DELETE',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'X-Organization-Id': request.headers.get('X-Organization-Id') || '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Set-Cookie': response.headers.get('Set-Cookie') || '',
      },
    });
  } catch (error) {
    console.error('Org proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization data' },
      { status: 500 }
    );
  }
}
