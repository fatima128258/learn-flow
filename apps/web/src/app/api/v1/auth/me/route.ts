import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const cookie = req.headers.get('cookie') || '';
  const resp = await fetch(`${apiBase}/api/v1/auth/me`, {
    method: 'GET',
    headers: { Cookie: cookie },
  });
  const data = await resp.text();
  return new NextResponse(data, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
