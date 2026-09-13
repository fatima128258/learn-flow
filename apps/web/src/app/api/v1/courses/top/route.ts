import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl = process.env.BACKEND_URL
    || process.env.NEXT_PUBLIC_BACKEND_URL
    || 'https://learn-flow-1-1gl3.onrender.com';

  try {
    const response = await fetch(`${backendUrl}/api/v1/courses/top`, {
      method: 'GET',
      next: { revalidate: 60 },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, error: 'SERVER_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
