import { test, expect } from '@playwright/test';
import { loadFixtures } from '../support/fixtures';
import { login } from '../support/ui';
import { expectToast } from '../support/mailpit';

test.describe('Course purchase journey', () => {
  const fixtures = loadFixtures();

  test('student buys the published course and it appears in their dashboard', async ({ page }) => {
    await login(page, fixtures.credentials.buyer.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard\/student$/);

    await page.goto(`/courses/${fixtures.courseId}`);
    await page.getByRole('link', { name: 'Enroll Now' }).click();

    await expect(page).toHaveURL(new RegExp(`/checkout/${fixtures.courseId}$`));
    await expect(page.getByText('E2E React Fundamentals').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay $29.99' })).toBeVisible();

    await page.getByRole('button', { name: 'Pay $29.99' }).click();

    await expect(page.getByRole('heading', { name: 'Payment successful', level: 1 })).toBeVisible();
    await expectToast(page, 'Purchase completed successfully.');

    await page.goto('/dashboard/student');
    await expect(page.getByText('E2E React Fundamentals').first()).toBeVisible();
  });
});