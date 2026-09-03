import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL;
    
    if (!backendUrl) {
      return NextResponse.json(
        { error: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    // Forward all query parameters
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const forwardUrl = `${backendUrl}/api/v1/admin/audit-logs${queryString ? '?' + queryString : ''}`;

    // Forward the request with cookies
    const response = await fetch(forwardUrl, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    // Return the response with proper status code
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Set-Cookie': response.headers.get('Set-Cookie') || '',
      },
    });
  } catch (error) {
    console.error('Audit logs proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
