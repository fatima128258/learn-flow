import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const body = await req.json();
  const resp = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
  const data = await resp.text();
  
  // Forward all response headers from backend, including Set-Cookie for session persistence
  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Copy Set-Cookie headers from backend response
  const setCookieHeader = resp.headers.get('set-cookie');
  if (setCookieHeader) {
    responseHeaders['set-cookie'] = setCookieHeader;
  }
  
  return new NextResponse(data, { status: resp.status, headers: responseHeaders });
}
