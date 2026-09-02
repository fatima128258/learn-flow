import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Server-side: use direct Render backend URL (not proxied)
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const body = await req.json();
  const resp = await fetch(`${backendUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
  const data = await resp.text();
  
  // Create response with proper Set-Cookie forwarding
  const response = new NextResponse(data, { status: resp.status });
  
  // Forward Set-Cookie headers from backend
  // Use getSetCookie() which properly handles multiple Set-Cookie headers
  const setCookies = resp.headers.getSetCookie();
  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie);
  }
  
  // Ensure Content-Type is set
  response.headers.set('Content-Type', 'application/json');
  
  return response;
}
