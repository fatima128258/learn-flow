import { test } from '@playwright/test';

test('probe register long-wait', async ({ page }) => {
  const log: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) log.push(`REQ ${r.method()} ${r.url()}`); });
  page.on('requestfinished', async (r) => { if (r.url().includes('/api/')) log.push(`DONE ${r.method()} ${r.url()} ${(await r.response())?.status()}`); });
  page.on('requestfailed', (r) => log.push(`FAIL ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.url().includes('/api/')) log.push(`RESP ${r.status()} ${r.url()}`); });
  page.on('console', (m) => { const t = m.text(); if (t.includes('api') || t.includes('Failed')) log.push(`console: ${t}`); });

  await page.goto('/register');
  await page.getByLabel('Full name').fill('LongWait Probe');
  await page.getByLabel('Email address').fill('longwait-' + Date.now() + '@e2e.test');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LongWait123!');
  await page.getByRole('textbox', { name: 'Confirm password', exact: true }).fill('LongWait123!');
  await page.getByRole('main').getByRole('button', { name: 'Create account' }).click();

  const deadline = Date.now() + 90000;
  const target = page.getByText('Account created successfully!');
  let seen = false;
  while (Date.now() < deadline) {
    if (await target.isVisible().catch(() => false)) { seen = true; break; }
    await page.waitForTimeout(2000);
  }
  log.push(`SUCCESS_ALERT_VISIBLE=${seen}`);
  console.log('PROBE-LOG-BEGIN\n' + log.join('\n') + '\nPROBE-LOG-END');
});