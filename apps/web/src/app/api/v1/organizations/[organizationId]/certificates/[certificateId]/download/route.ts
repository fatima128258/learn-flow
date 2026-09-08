import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string; certificateId: string }> }
) {
  const { organizationId, certificateId } = await params;
  const backendUrl = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';
  const response = await fetch(
    `${backendUrl}/api/v1/organizations/${organizationId}/certificates/${certificateId}/download`,
    {
      headers: {
        Cookie: req.headers.get('cookie') || '',
      },
    }
  );

  const body = await response.arrayBuffer();
  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  const contentDisposition = response.headers.get('content-disposition');

  if (contentType) headers.set('content-type', contentType);
  if (contentDisposition) headers.set('content-disposition', contentDisposition);

  return new NextResponse(body, {
    status: response.status,
    headers,
  });
}
