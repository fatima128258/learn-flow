import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Server-side: use direct Render backend URL (not proxied)
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const cookie = req.headers.get('cookie') || '';
  const resp = await fetch(`${backendUrl}/api/v1/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
  const data = await resp.text();
  
  // Create response with proper Set-Cookie forwarding
  const response = new NextResponse(data, { status: resp.status });
  
  // Forward Set-Cookie headers from backend (includes cookie clearing directives)
  // Use getSetCookie() which properly handles multiple Set-Cookie headers
  const setCookies = resp.headers.getSetCookie();
  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie);
  }
  
  // Ensure Content-Type is set
  response.headers.set('Content-Type', 'application/json');
  
  return response;
}
