import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Server-side: use direct Render backend URL (not proxied)
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const cookie = req.headers.get('cookie') || '';
  const resp = await fetch(`${backendUrl}/api/v1/auth/me`, {
    method: 'GET',
    headers: { Cookie: cookie },
  });
  const data = await resp.text();
  return new NextResponse(data, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
