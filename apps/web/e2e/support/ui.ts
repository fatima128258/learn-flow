import { Page, expect } from '@playwright/test';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export async function registerUser(
  page: Page,
  name: string,
  email: string,
  password: string,
) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('textbox', { name: 'Confirm password', exact: true }).fill(password);
  await page.getByRole('main').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Account created successfully!')).toBeVisible();
  // Wait for redirect to welcome page
  await page.waitForURL((url) => url.pathname === '/welcome');
  await expect(page.getByText('Account Created Successfully!')).toBeVisible();
}

export function randomEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@e2e.test`;
}