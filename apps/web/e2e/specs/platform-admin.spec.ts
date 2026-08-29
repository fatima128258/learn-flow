import { test, expect } from '@playwright/test';
import { loadFixtures } from '../support/fixtures';
import { login } from '../support/ui';

test.describe('Platform admin – organization management', () => {
  const fixtures = loadFixtures();

  test('creates an organization and sees it in the list', async ({ page }) => {
    await login(page, fixtures.credentials.platformAdmin.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/dashboard/organizations');
    await expect(page.getByRole('heading', { name: 'Organizations', level: 1 })).toBeVisible();

    const name = `E2E Org ${Date.now()}`;
    await page.getByRole('button', { name: 'Create Organization' }).first().click();
    await page.getByRole('dialog').getByLabel('Organization name').fill(name);
    await page.getByRole('button', { name: 'Create Organization' }).last().click();

    await expect(page.getByText(`Organization "${name}" was created.`)).toBeVisible();
    await expect(page.locator('tr', { hasText: name }).first()).toBeVisible();
  });
});