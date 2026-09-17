import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  // Server-side: use direct Render backend URL (not proxied)
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const body = await req.json();
  const forwardedFor = req.headers.get('x-forwarded-for');
  const requestId = req.headers.get('x-request-id') || randomUUID();
  const startedAt = performance.now();
  const headers: HeadersInit = { 'Content-Type': 'application/json', 'x-request-id': requestId };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  const fetchStartedAt = performance.now();
  const resp = await fetch(`${backendUrl}/api/v1/auth/login`, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
  console.log(`[AUTH_PERF] request=${requestId} stage=bff_login_fetch durationMs=${Number((performance.now() - fetchStartedAt).toFixed(2))}`);
  const data = await resp.text();
  
  // Create response with proper Set-Cookie forwarding
  const response = new NextResponse(data, { status: resp.status });
  
  // Forward Set-Cookie headers from backend
  // Use getSetCookie() which properly handles multiple Set-Cookie headers
  const setCookies = typeof resp.headers.getSetCookie === 'function'
    ? resp.headers.getSetCookie()
    : (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie') as string] : []);
  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie);
  }
  
  // Ensure Content-Type is set
  response.headers.set('Content-Type', 'application/json');
  console.log(`[AUTH_PERF] request=${requestId} stage=bff_login_total durationMs=${Number((performance.now() - startedAt).toFixed(2))}`);
  
  return response;
}
