import { test, expect } from '@playwright/test';
import { loadFixtures } from '../support/fixtures';
import { login, randomEmail } from '../support/ui';
import { expectToast } from '../support/mailpit';

test.describe('Organization admin – user management', () => {
  const fixtures = loadFixtures();

  test('adds an instructor through the modal and sees them in the list', async ({ page }) => {
    await login(page, fixtures.credentials.orgAdmin.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard\/organization$/);

    await page.goto('/dashboard/organization/users');
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();

    const email = randomEmail('e2e-inst');
    await page.getByRole('button', { name: 'Add Instructor' }).click();
    await page.getByRole('dialog').getByLabel('Full name').fill('E2E Instructor');
    await page.getByRole('dialog').getByLabel('Email address').fill(email);
    await page.getByRole('dialog').getByRole('textbox', { name: 'Password' }).fill('E2Epass123!');
    await page.getByRole('button', { name: 'Add Instructor' }).last().click();

    await expectToast(page, `${email} was added as an instructor.`);
    await expect(page.getByRole('cell', { name: email }).first()).toBeVisible();
  });
});