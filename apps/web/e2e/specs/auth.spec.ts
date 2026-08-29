import { test, expect } from '@playwright/test';
import { registerUser, randomEmail } from '../support/ui';
import { findVerificationToken } from '../support/mailpit';

test.describe('Authentication journey', () => {
  test('registers, verifies through the emailed link, then signs in', async ({ page }) => {
    const email = randomEmail('e2e-reg');
    const password = 'E2Epass123!';

    await registerUser(page, 'E2E Registered Student', email, password);

    const token = await findVerificationToken(email);
    expect(token.length).toBeGreaterThan(8);

    await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
    await expect(page.getByText('Email verified successfully!')).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    await expect(page.getByRole('heading', { name: /Transform Learning into/ })).toBeVisible();
  });
});