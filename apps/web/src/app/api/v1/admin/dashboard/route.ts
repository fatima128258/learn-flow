import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const cookie = req.headers.get('cookie') || '';
  const resp = await fetch(`${apiBase}/api/v1/admin/dashboard`, {
    method: 'GET',
    headers: { Cookie: cookie },
    credentials: 'include',
  });
  const data = await resp.text();
  return new NextResponse(data, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
