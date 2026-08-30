import { test, expect, type Page } from '@playwright/test';

const FIELDS = ['Full name', 'Email address'];
const REGISTER_API = '**/api/v1/auth/register';

function passwordFields(page: Page) {
  return [page.getByLabel('Password', { exact: true }), page.getByLabel('Confirm password')];
}

test.describe('Signup page', () => {
  test('renders the split layout with brand panel, all fields, and sign-in footer link', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/register');

    await expect(page.locator('h1', { hasText: 'Create your account' })).toBeVisible();
    // Brand panel visible on desktop (shared AuthVisual)
    await expect(page.getByText('Learn something that sticks.')).toBeVisible();

    for (const field of FIELDS) {
      await expect(page.getByLabel(field)).toBeVisible();
    }
    for (const field of passwordFields(page)) {
      await expect(field).toBeVisible();
    }

    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();

    // Footer navigation to sign in
    const footer = page.getByText('Already have an account?');
    await expect(footer).toBeVisible();
    const signIn = page.getByRole('link', { name: 'Sign in', exact: true });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', '/login');
  });

  test('inputs use the minimal line style (bottom border only) and turn primary on focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/register');
    const email = page.getByLabel('Email address');

    await expect(email).toHaveCSS('border-top-width', '0px');
    await expect(email).toHaveCSS('border-left-width', '0px');
    await expect(email).toHaveCSS('border-bottom-width', '2px');
    await expect(email).toHaveCSS('border-bottom-color', 'rgb(203, 213, 225)'); // neutral-300

    await email.focus();
    await expect(email).toHaveCSS('border-bottom-color', 'rgb(124, 58, 237)'); // primary-600

    // Password fields share the same minimal style
    const confirm = page.getByLabel('Confirm password');
    await expect(confirm).toHaveCSS('border-bottom-width', '2px');
    await confirm.focus();
    await expect(confirm).toHaveCSS('border-bottom-color', 'rgb(124, 58, 237)');
  });

  test('validation shows inline errors for every field and does not call the API', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let called = false;
    await page.route(REGISTER_API, () => { called = true; });
    await page.goto('/register');

    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page.getByText('Please confirm your password')).toBeVisible();
    expect(called).toBe(false);

    // Invalid values produced the detailed messages and red error border
    await page.getByLabel('Full name').fill('A');
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('123');
    await page.getByLabel('Confirm password').fill('different');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    await expect(page.getByText('Passwords do not match')).toBeVisible();

    const email = page.getByLabel('Email address');
    await expect(email).toHaveCSS('border-bottom-color', 'rgb(239, 68, 68)'); // error-500
    expect(called).toBe(false);
  });

  test('loading state disables the form while the registration request is pending', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let release: (() => void) | undefined;
    let called = 0;
    await page.route(REGISTER_API, (route) => {
      called += 1;
      release = () => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Email is already registered' }),
        });
      };
    });
    await page.goto('/register');

    await page.getByLabel('Full name').fill('Jane Doe');
    await page.getByLabel('Email address').fill('jane@example.com');
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Confirm password').fill('password123');

    const btn = page.locator('button[type="submit"]');
    await btn.click();

    // While the request is still pending: disabled button, spinner, loading text,
    // disabled inputs, and exactly one API request started.
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('Creating account...');
    await expect(btn.locator('svg.animate-spin')).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeDisabled();
    await expect(page.getByLabel('Email address')).toBeDisabled();
    await expect(page.getByLabel('Password', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Confirm password')).toBeDisabled();
    await expect.poll(() => called).toBe(1);

    // Release the held request: the error is surfaced and the form is usable again
    release?.();
    await expect(page.getByText('Email is already registered')).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('Create account');
    await expect(page.getByLabel('Email address')).toBeEnabled();
  });

  test('successful registration shows the success alert and disables the form', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let called = 0;
    await page.route(REGISTER_API, (route) => {
      called += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto('/register');

    await page.getByLabel('Full name').fill('Jane Doe');
    await page.getByLabel('Email address').fill('jane@example.com');
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Confirm password').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Account created successfully!')).toBeVisible();
    await expect(page.getByText('You can now sign in with your credentials.')).toBeVisible();
    expect(called).toBe(1);
    // Form frozen after success to prevent duplicate submissions
    await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
    await expect(page.getByLabel('Email address')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  });

  test('sign-in footer link navigates to /login and login sign-up link navigates to /register', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto('/register');
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible();

    await page.getByRole('link', { name: 'Sign up', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('h1', { hasText: 'Create your account' })).toBeVisible();
  });

  test('no horizontal overflow and a fully visible form across all requested breakpoints', async ({ page }) => {
    const widths = [1440, 1280, 1024, 768, 600, 390, 375, 320];
    await page.setViewportSize({ width: widths[0], height: 900 });
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Full name')).toBeVisible();

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);

      await expect(page.getByLabel('Full name')).toBeVisible();
      const btn = page.getByRole('button', { name: 'Create account' });
      await expect(btn).toBeVisible();
      const btnBox = await btn.boundingBox();
      expect(btnBox, `button off-screen at ${width}px`).not.toBeNull();
      expect((btnBox?.x ?? 0) >= 0, `button left clip at ${width}px`).toBe(true);
      expect(
        (btnBox?.x ?? 0) + (btnBox?.width ?? 0) <= width + 1,
        `button right clip at ${width}px`
      ).toBe(true);

      // Brand panel mirrors Login: visible at lg (>=1024), hidden below
      const brand = page.getByText('Learn something that sticks.');
      if (width >= 1024) {
        await expect(brand).toBeVisible();
      } else {
        await expect(brand).toBeHidden();
      }
    }
  });

  test('prefers-reduced-motion renders the signup content immediately without layout problems', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/register');

    await expect(page.locator('h1', { hasText: 'Create your account' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});