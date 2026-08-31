import { test, expect, type Page, type Route } from '@playwright/test';
import { login } from '../support/ui';

const PASS = 'admin123';
const EMAIL = 'admin@gmail.com';

function uniqueProbeIp(): string {
  return `10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
}

function auditRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/v1/admin/audit-logs')) urls.push(req.url());
  });
  return urls;
}

// Waits for an audit-logs response whose `search` query param matches `term`
// (or which has no search param when `term` is ''). Deterministic vs. timeouts.
function waitForSearch(page: Page, term: string) {
  return page.waitForResponse(
    (r) => {
      if (!r.url().includes('/api/v1/admin/audit-logs')) return false;
      try {
        const url = new URL(r.url());
        return (url.searchParams.get('search') ?? '') === term;
      } catch {
        return false;
      }
    },
    { timeout: 10_000 },
  );
}

test.describe('Audit Logs page search', () => {
  test.beforeEach(async ({ page }) => {
    const probeIp = uniqueProbeIp();
    await page.route('**://localhost:4000/**', async (route: Route) => {
      try {
        await route.continue({
          headers: { ...route.request().headers(), 'x-forwarded-for': probeIp },
        });
      } catch {
        // navigation may abort the request; ignore
      }
    });
  });

  test('loads, search bar filters by actor name/email/action, debounces, and clears to full list', async ({ page }) => {
    await login(page, EMAIL, PASS);
    await expect(page).toHaveURL(/\/dashboard$/);

    const auditUrls = auditRequests(page);

    await page.goto('/dashboard/audit-logs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Audit Logs', level: 1 })).toBeVisible();

    // 1. Page loads successfully: either the table (events) or empty state, never an error state.
    const searchInput = page.getByLabel('Search logs');
    await expect(searchInput).toBeVisible();

    // Wait for the initial audit-logs request to complete so the list settles.
    await page.waitForResponse(
      (r) => r.url().includes('/api/v1/admin/audit-logs') && r.status() === 200,
    );
    // Wait for the table (events) to appear; the error state is asserted separately below.
    await expect
      .poll(
        async () => (await page.locator('tbody tr').count()) > 0,
        { message: 'audit list rendered without error' },
      )
      .toBe(true);

    const errState = page.getByText('Unable to load audit logs');
    await expect(errState).toHaveCount(0);

    // Snapshot the baseline row count for later restore checks.
    const rowsBefore = await page.locator('tbody tr').count();

    // 2. Search by actor email (partial) via the top search bar.
    const emailResp = waitForSearch(page, EMAIL);
    await searchInput.fill(EMAIL);
    await emailResp;
    await expect(page.locator('tbody tr').first()).toContainText(EMAIL);

    // 3. Search by actor name (partial: "Platform").
    const nameResp = waitForSearch(page, 'Platform');
    await searchInput.fill('Platform');
    await nameResp;
    const nameColText = await page.locator('tbody tr td:nth-child(2)').first().textContent();
    expect(nameColText).toContain('Platform Admin');

    // 4. Search by action value.
    const actionResp = waitForSearch(page, 'LOGIN');
    await searchInput.fill('LOGIN');
    await actionResp;
    const actionTexts = await page.locator('tbody tr td:first-child').allTextContents();
    expect(actionTexts.length).toBeGreaterThan(0);
    for (const t of actionTexts) expect(t).toContain('LOGIN');

    // 5. Debounce: typing a fresh query char-by-char fires a single debounced
    //    request, not one per keystroke (300ms debounce). Use a value not yet typed
    //    so a clean baseline is measured.
    await searchInput.fill('');
    const clearResp = waitForSearch(page, '');
    await clearResp;
    await page.waitForTimeout(350); // ensure no trailing debounce fires (see below)
    const baselineAfterClear = auditUrls.length;
    await searchInput.pressSequentially('SESS', { delay: 40 }); // 4 keys, rapid
    await page.waitForTimeout(600);
    const requestsDuringType = auditUrls.length - baselineAfterClear;
    // Typing a 4-char phrase should coalesce into at most 1 request (debounced).
    expect(requestsDuringType).toBeLessThanOrEqual(1);
    // And the (eventual) list reflects the combined query, not intermediate states:
    // "SESS" partial-matches resourceId (session-*) on the existing LOGIN events, so
    // the list should be non-empty and settled (not stuck loading), showing results.
    await expect
      .poll(async () => page.locator('tbody tr').count())
      .toBeGreaterThan(0);
    await expect(page.getByText('Loading audit logs...')).toHaveCount(0);

    // 6. Clear search restores the full list.
    const clearResp2 = waitForSearch(page, '');
    await searchInput.fill('');
    await clearResp2;
    await expect
      .poll(async () => page.locator('tbody tr').count())
      .toBe(rowsBefore);

    // 7. No error state / no layout regressions after all interactions.
    await expect(errState).toHaveCount(0);
    await expect(searchInput).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // The single top search bar is the only input on the page (old per-column
    // "Search by action" field is gone), so there should be exactly one visible input.
    await expect(page.locator('main input')).toHaveCount(1);
  });
});
