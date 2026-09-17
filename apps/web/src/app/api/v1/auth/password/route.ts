import { NextResponse } from 'next/server';

export async function PATCH(req: Request) {
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const cookie = req.headers.get('cookie') || '';
  const forwardedFor = req.headers.get('x-forwarded-for');

  const headers: HeadersInit = {
    Cookie: cookie,
    'Content-Type': 'application/json',
  };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  const response = await fetch(`${backendUrl}/api/v1/auth/password`, {
    method: 'PATCH',
    headers,
    body: await req.text(),
  });
  const data = await response.text();

  return new NextResponse(data, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
