import { cookies } from 'next/headers';
import type { CurrentUser, MeResponse } from '../../lib/types';

const BACKEND_URL = process.env.BACKEND_URL || 'https://learn-flow-1-1gl3.onrender.com';

export async function getServerCurrentUser(): Promise<CurrentUser | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const body = await response.json() as MeResponse;
    return body.user ?? null;
  } catch {
    return null;
  }
}
