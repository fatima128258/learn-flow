import { test, expect } from '@playwright/test';

test.describe('Authentication pages redesign', () => {
  test('login page renders the split layout with brand panel and form', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login');
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible();
    // Brand panel present on desktop
    await expect(page.getByText('Learn something that sticks.')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();
  });

  test('inputs use the minimal line style (bottom border only) and turn primary on focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login');
    const email = page.getByLabel('Email address');

    // No full rectangular border: top/left/right are 0, bottom is 2px.
    await expect(email).toHaveCSS('border-top-width', '0px');
    await expect(email).toHaveCSS('border-left-width', '0px');
    await expect(email).toHaveCSS('border-bottom-width', '2px');
    await expect(email).toHaveCSS('border-bottom-color', 'rgb(203, 213, 225)'); // neutral-300 (slate)

    await email.focus();
    await expect(email).toHaveCSS('border-bottom-color', 'rgb(124, 58, 237)'); // primary-600
  });

  test('primary submit button changes to hover color on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login');
    const btn = page.getByRole('button', { name: 'Sign in' });
    await btn.hover();
    await expect(btn).toHaveCSS('background-color', 'rgb(109, 40, 217)'); // primary-700
  });

  test('validation shows inline errors and does not call the API', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let called = false;
    await page.route('**/api/v1/auth/login', () => { called = true; });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    expect(called).toBe(false);
  });

  test('loading state is shown (spinner + disabled) while the API request is pending', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/v1/auth/login', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid email or password' }),
      });
    });
    await page.goto('/login');
    await page.getByLabel('Email address').fill('student@learnflow.app');
    await page.getByLabel('Password', { exact: true }).fill('password123');
    const btn = page.locator('button[type="submit"]');
    await btn.click();
    // Immediately after click the request is pending
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('Signing in...');
    await expect(btn.locator('svg.animate-spin')).toBeVisible();
    // After the (delayed) response, the error is surfaced and the button is usable again
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('register page uses the same language and line inputs, with password requirements', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/register');
    await expect(page.locator('h1', { hasText: 'Create your account' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();

    const name = page.getByLabel('Full name');
    await expect(name).toHaveCSS('border-bottom-width', '2px');
  });

  test('reduced motion still renders the form content', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login');
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
  });

  test('mobile (320px) has no horizontal overflow and hides the brand panel', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/login');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByText('Learn something that sticks.')).toBeHidden();
    await expect(page.getByLabel('Email address')).toBeVisible();
  });
});
