import { test, expect, Page } from '@playwright/test';
import { loadFixtures } from '../support/fixtures';
import { login } from '../support/ui';

const placeholders: Record<
  'Platform Admin' | 'Organization Admin',
  { present: readonly string[]; absent: readonly string[] }
> = {
  'Platform Admin': {
    present: ['Organizations'],
    absent: ['Courses', 'Users', 'Analytics'],
  },
  'Organization Admin': {
    present: ['Courses', 'Users', 'Analytics'],
    absent: ['Organizations'],
  },
};

async function expectSidebar(
  page: Page,
  navLabel: 'Platform Admin' | 'Organization Admin',
) {
  const spec = placeholders[navLabel];
  const nav = page.getByRole('navigation', { name: navLabel });

  await expect(nav).toBeVisible();

  for (const label of spec.present) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
  for (const label of spec.absent) {
    await expect(nav.getByRole('link', { name: label })).toHaveCount(0);
  }
}

test.describe('Sidebar context switching', () => {
  const fixtures = loadFixtures();

  test('platform dashboard shows only platform navigation', async ({ page }) => {
    await login(page, fixtures.credentials.platformAdmin.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectSidebar(page, 'Platform Admin');
  });

  test('opening an org shows only organization navigation, then back shows only platform nav', async ({ page }) => {
    await login(page, fixtures.credentials.platformAdmin.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectSidebar(page, 'Platform Admin');

    await page.goto(`/dashboard/organization?organization=${fixtures.organizationId}`);
    await expectSidebar(page, 'Organization Admin');

    await page.goto('/dashboard');
    await expectSidebar(page, 'Platform Admin');
  });

  test('repeated switching does not duplicate or accumulate menu items', async ({ page }) => {
    await login(page, fixtures.credentials.platformAdmin.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    for (let i = 0; i < 3; i += 1) {
      await page.goto(`/dashboard/organization?organization=${fixtures.organizationId}`);
      await expectSidebar(page, 'Organization Admin');

      const orgNav = page.getByRole('navigation', { name: 'Organization Admin' });
      for (const label of ['Dashboard', 'Courses', 'Users', 'Analytics', 'Settings', 'Audit Logs']) {
        await expect(orgNav.getByRole('link', { name: label })).toHaveCount(1);
      }

      await page.goto('/dashboard');
      await expectSidebar(page, 'Platform Admin');

      const platformNav = page.getByRole('navigation', { name: 'Platform Admin' });
      for (const label of ['Dashboard', 'Organizations', 'Audit Logs', 'Settings']) {
        await expect(platformNav.getByRole('link', { name: label })).toHaveCount(1);
      }
    }
  });
});
