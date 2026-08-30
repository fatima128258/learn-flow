import { test, expect } from '@playwright/test';
import { loadFixtures } from '../support/fixtures';
import { login, registerUser, randomEmail } from '../support/ui';
import { findVerificationToken, expectToast } from '../support/mailpit';

const fixtures = loadFixtures();

test.describe.configure({ mode: 'serial' });

test.describe('PHASE 3 — full-platform browser journey', () => {
  const email = randomEmail('p3-browser');
  const password = 'P3!Learns123';
  const studentEmail = fixtures.credentials.student.email;
  const studentPassword = fixtures.credentials.password;

  test('register -> verify via real email -> auto-redirect', async ({ page }) => {
    await registerUser(page, 'Phase3 Learning Student', email, password);

    const token = await findVerificationToken(email);
    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByText('Email verified successfully!')).toBeVisible();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('enroll via checkout UI and pay for the published course', async ({ page }) => {
    await login(page, studentEmail, studentPassword);

    await page.goto(`/checkout/${fixtures.courseId}`, { waitUntil: 'domcontentloaded' });
    await page.goto(`/courses/${fixtures.courseId}`);
    await page.getByRole('link', { name: 'Enroll Now' }).click();

    await expect(page).toHaveURL(new RegExp(`/checkout/${fixtures.courseId}$`), { timeout: 30_000 });
    await expect(page.getByText('E2E React Fundamentals').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay $29.99' })).toBeVisible();

    await page.getByRole('button', { name: 'Pay $29.99' }).click();

    await expect(page.getByRole('heading', { name: 'Payment successful', level: 1 })).toBeVisible();
    await expectToast(page, 'Purchase completed successfully.');

    await page.goto('/dashboard/student');
    await expect(page.getByText('E2E React Fundamentals').first()).toBeVisible();
  });

  test('complete every lesson via UI -> course marked Completed', async ({ page }) => {
    await login(page, studentEmail, studentPassword);

    async function markLesson(title: string) {
      await page.goto(`/dashboard/student/courses/${fixtures.courseId}`);
      await page.getByRole('link', { name: 'Getting Started' }).click();
      await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 30_000 });
      await page.getByRole('link', { name: title }).click();
      await expect(page.getByRole('button', { name: 'Mark as Complete' })).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Mark as Complete' }).click();
    }

    await page.goto(`/dashboard/student/courses/${fixtures.courseId}/progress`, { waitUntil: 'domcontentloaded' });
    await markLesson('Introduction');
    await markLesson('JSX Basics');

    await page.goto(`/dashboard/student/courses/${fixtures.courseId}/progress`);
    await expect(page.getByText('2 of 2 lessons completed')).toBeVisible();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate Certificate' })).toBeVisible();
  });

  test('seeded instructor signs in, sees dashboard, signs out', async ({ page }) => {
    await login(page, fixtures.credentials.instructor.email, fixtures.credentials.password);
    await expect(page).toHaveURL(/\/dashboard\/instructor$/);
    await expect(page.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 15_000 });
  });
});