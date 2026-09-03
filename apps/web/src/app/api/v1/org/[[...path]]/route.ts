import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const backendUrl = process.env.BACKEND_URL;
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
      method: 'GET',
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
      { error: 'Failed to fetch organization data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const backendUrl = process.env.BACKEND_URL;
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
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const backendUrl = process.env.BACKEND_URL;
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
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const backendUrl = process.env.BACKEND_URL;
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
