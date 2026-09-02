import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const cookie = req.headers.get('cookie') || '';
  const resp = await fetch(`${apiBase}/api/v1/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
  const data = await resp.text();
  
  // Forward all response headers from backend, including Set-Cookie for session clearing
  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Copy Set-Cookie headers from backend response (includes cookie clearing directives)
  const setCookieHeader = resp.headers.get('set-cookie');
  if (setCookieHeader) {
    responseHeaders['set-cookie'] = setCookieHeader;
  }
  
  return new NextResponse(data, { status: resp.status, headers: responseHeaders });
}
