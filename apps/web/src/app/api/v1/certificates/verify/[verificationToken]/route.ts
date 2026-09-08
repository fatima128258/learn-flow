import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ verificationToken: string }> },
) {
  const { verificationToken } = await params;
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const response = await fetch(
    `${backendUrl}/api/v1/certificates/verify/${verificationToken}`,
  );
  const data = await response.text();

  return new NextResponse(data, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
