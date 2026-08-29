import { Page, expect } from '@playwright/test';

const MAILPIT_API = process.env.MAILPIT_API || 'http://localhost:8025/api/v1';

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${MAILPIT_API}${path}`, init);
  if (!res.ok) throw new Error(`Mailpit request failed: ${res.status} ${path}`);
  return res.json();
}

export async function findVerificationToken(email: string, timeoutMs = 20_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { messages } = await request('/messages?limit=50');
    const match = messages?.find(
      (m: any) => m.Subject?.toLowerCase().includes('verify')
        && m.To?.some((to: any) => to.Address === email),
    );
    if (match) {
      const detail = await request(`/message/${match.ID}`);
      const hit = detail.HTML?.match(/\/verify-email\?token=([A-Za-z0-9_-]+)/);
      if (hit) return decodeURIComponent(hit[1]);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for verification email to ${email}`);
}

export async function expectToast(page: Page, text: string) {
  const toast = page
    .locator('[aria-live="polite"]')
    .getByText(text)
    .first();
  await expect(toast).toBeVisible({ timeout: 10_000 });
}

export async function expectPageHeading(page: Page, text: string) {
  await expect(page.getByRole('heading', { name: text, level: 1 }).or(page.getByRole('heading', { name: text })).first()).toBeVisible();
}