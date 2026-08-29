import { test, expect } from '@playwright/test';
import { loadFixtures } from '../support/fixtures';
import { login } from '../support/ui';

test.describe('Instructor dashboard', () => {
  const fixtures = loadFixtures();

  test('shows seeded courses and opens the builder for a course', async ({ page }) => {
    await login(page, fixtures.credentials.instructor.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard\/instructor$/);

    await expect(page.getByRole('heading', { name: /Welcome, E2E Instructor/ })).toBeVisible();
    await expect(page.getByText('E2E React Fundamentals').first()).toBeVisible();
    await expect(page.getByText('E2E Draft Course').first()).toBeVisible();

    const manage = page
      .locator('tr', { hasText: 'E2E React Fundamentals' })
      .getByRole('link', { name: 'Manage' });
    await manage.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/organization/courses/${fixtures.courseId}`));
    await expect(page.getByText('E2E React Fundamentals').first()).toBeVisible();
  });
});