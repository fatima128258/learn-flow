import { test, expect } from '@playwright/test';
import { registerUser, randomEmail } from '../support/ui';
import { findVerificationToken, expectToast } from '../support/mailpit';

const PASSWORD = 'E2Epass123!';

test.describe('Account settings journey', () => {
  test('changes the email address: old email stops working, new email signs in after verification', async ({ page }) => {
    const oldEmail = randomEmail('e2e-settings-email');
    const newEmail = randomEmail('e2e-settings-new');

    await registerUser(page, 'E2E Settings Student', oldEmail, PASSWORD);
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(`You are signed in as ${oldEmail}.`)).toBeVisible();

    await page.getByLabel('New email address').fill(newEmail);
    await page.getByRole('main').getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Email updated');
    await expect(page.getByText(`You are signed in as ${newEmail}.`)).toBeVisible();

    const token = await findVerificationToken(newEmail);
    expect(token.length).toBeGreaterThan(8);
    await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
    await expect(page.getByText('Email verified successfully!')).toBeVisible();

    await page.context().clearCookies();
    await page.goto('/login');

    await page.getByLabel('Email address').fill(oldEmail);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await expectToast(page, 'Invalid email or password.');

    await page.getByLabel('Email address').fill(newEmail);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));

    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(`You are signed in as ${newEmail}.`)).toBeVisible();
  });

  test('changes the password: old password stops working, new password signs in', async ({ page }) => {
    const email = randomEmail('e2e-settings-pass');
    const newPassword = 'E2Enew456!';

    await registerUser(page, 'E2E Settings Password', email, PASSWORD);
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });

    await page.getByRole('textbox', { name: 'Current password', exact: true }).fill(PASSWORD);
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill(newPassword);
    await page.getByRole('textbox', { name: 'Confirm new password', exact: true }).fill(newPassword);
    await page.getByRole('main').getByRole('button', { name: 'Update password' }).click();
    await expectToast(page, 'Password updated');

    await page.context().clearCookies();
    await page.goto('/login');

    await page.getByLabel('Email address').fill(email);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await expectToast(page, 'Invalid email or password.');

    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(newPassword);
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));

    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(`You are signed in as ${email}.`)).toBeVisible();
  });

  test('shows validation and current-password errors before accepting changes', async ({ page }) => {
    const email = randomEmail('e2e-settings-valid');

    await registerUser(page, 'E2E Settings Validation', email, PASSWORD);
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('New email address').fill('not-an-email');
    await page.getByRole('main').getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Please enter a valid email address.');

    await page.getByLabel('New email address').fill(email);
    await page.getByRole('main').getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'New email must be different from your current email.');

    await page.getByRole('textbox', { name: 'Current password', exact: true }).fill('WrongPass123!');
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('NewPass123!');
    await page.getByRole('textbox', { name: 'Confirm new password', exact: true }).fill('NewPass123!');
    await page.getByRole('main').getByRole('button', { name: 'Update password' }).click();
    await expectToast(page, 'Your current password is incorrect.');

    await page.getByRole('textbox', { name: 'Current password', exact: true }).fill(PASSWORD);
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('NewPass123!');
    await page.getByRole('textbox', { name: 'Confirm new password', exact: true }).fill('NewPass456!');
    await page.getByRole('main').getByRole('button', { name: 'Update password' }).click();
    await expectToast(page, 'Passwords do not match.');
  });

  test('shows a loading state while the email change is in flight', async ({ page }) => {
    const email = randomEmail('e2e-settings-loading');
    const newEmail = randomEmail('e2e-settings-loading-new');

    await registerUser(page, 'E2E Settings Loading', email, PASSWORD);
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });

    await page.route('**/api/v1/auth/me', async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    await page.getByLabel('New email address').fill(newEmail);
    await page.getByRole('main').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Saving...' })).toBeVisible();
    await expectToast(page, 'Email updated');
  });
});