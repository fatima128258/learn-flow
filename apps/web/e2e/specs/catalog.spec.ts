import { test, expect } from '@playwright/test';
import { loadFixtures } from '../support/fixtures';
import { login } from '../support/ui';

test.describe('Course catalog (student view)', () => {
  const fixtures = loadFixtures();

  test('published course shows details and an Enroll Now CTA', async ({ page }) => {
    await login(page, fixtures.credentials.buyer.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard\/student$/);

    await page.goto(`/courses/${fixtures.courseId}`);
    await expect(
      page.getByRole('heading', { name: 'E2E React Fundamentals', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('$29.99')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Enroll Now' })).toBeVisible();
    await expect(page.getByText('Modules').first()).toBeVisible();
  });

  test('draft course is not purchasable', async ({ page }) => {
    await login(page, fixtures.credentials.buyer.email, fixtures.credentials.password);

    await page.goto(`/courses/${fixtures.draftCourseId}`);
    await expect(page.getByText('Course not available')).toBeVisible();
    await expect(
      page.getByText('This course was not found or is not published yet.'),
    ).toBeVisible();
  });
});