import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Server-side: use direct Render backend URL (not proxied)
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const body = await req.json();
  const resp = await fetch(`${backendUrl}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.text();
  return new NextResponse(data, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
