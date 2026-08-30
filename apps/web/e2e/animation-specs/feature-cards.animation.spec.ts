import { test, expect, type Page } from '@playwright/test';

const FEATURE_TITLES = [
  'Structured courses',
  'Progress tracking',
  'Quizzes & assessments',
  'Certificates',
  'Instructor tools',
  'Organization workspaces',
  'Smart notifications',
  'Secure accounts',
];

const track = (page: Page) => page.locator('#features .features-marquee__track');
const cards = (page: Page) => page.locator('#features .features-marquee__track > div');

test.describe('Features section marquee', () => {
  test('features section exists and renders the real capability content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#features')).toBeVisible();
    for (const title of FEATURE_TITLES) {
      await expect(page.locator('#features')).toContainText(title);
    }
  });

  test('all cards live in a single horizontal row (no wrapping)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.locator('#features').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const all = cards(page);
    // 8 real cards + 8 duplicated for the seamless loop
    await expect(all).toHaveCount(16);

    const first = await all.nth(0).boundingBox();
    const ninth = await all.nth(8).boundingBox(); // first duplicated card
    expect(first).not.toBeNull();
    expect(ninth).not.toBeNull();
    // same vertical position => one row; ninth is far to the right => horizontal
    expect(Math.abs((ninth!.y ?? 0) - (first!.y ?? 0))).toBeLessThan(4);
    expect((ninth!.x ?? 0)).toBeGreaterThan((first!.x ?? 0));
  });

  test('duplicated sequence exists for a seamless loop, and the lead card stays tinted', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    // Each title appears at least twice (original + duplicate)
    for (const title of FEATURE_TITLES) {
      await expect(page.getByText(title, { exact: true })).toHaveCount(2);
    }
    await expect(cards(page).nth(0)).toHaveCSS('background-color', 'rgb(245, 243, 255)');
  });

  test('the row moves continuously right-to-left and loops infinitely with linear timing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.locator('#features').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await expect(track(page)).toHaveCSS('animation-timing-function', 'linear');
    await expect(track(page)).toHaveCSS('animation-iteration-count', 'infinite');

    const tx = async () =>
      track(page).evaluate((el: HTMLElement) => {
        const m = new DOMMatrix(getComputedStyle(el).transform);
        return m.m41;
      });

    const start = await tx();
    await page.waitForTimeout(1500);
    const later = await tx();
    // moving left => translateX decreases
    expect(later).toBeLessThan(start);
  });

  test('hovering the marquee pauses the animation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.locator('#features').scrollIntoViewIfNeeded();
    await expect(page.locator('.features-marquee')).toBeVisible();
    // Let the reveal transition settle so the hover lands on a stable element
    await page.waitForTimeout(700);

    const box = await page.locator('.features-marquee').boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
    await page.waitForTimeout(300);
    await expect(track(page)).toHaveCSS('animation-play-state', 'paused');
  });

  test('prefers-reduced-motion disables the animation and keeps cards visible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.locator('#features').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await expect(track(page)).toHaveCSS('animation-name', 'none');
    await expect(cards(page).nth(0)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('mobile (320px) keeps a single horizontal row with no page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/');
    await page.locator('#features').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const all = cards(page);
    const first = await all.nth(0).boundingBox();
    const ninth = await all.nth(8).boundingBox();
    expect(Math.abs((ninth!.y ?? 0) - (first!.y ?? 0))).toBeLessThan(4);
    expect((ninth!.x ?? 0)).toBeGreaterThan((first!.x ?? 0));

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
