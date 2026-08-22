import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const body = await req.json();
  const resp = await fetch(`${apiBase}/api/v1/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.text();
  return new NextResponse(data, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
