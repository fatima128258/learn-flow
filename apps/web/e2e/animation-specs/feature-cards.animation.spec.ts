import { test, expect } from '@playwright/test';

/**
 * Verifies the Features section entrance animation and hover interaction.
 * These are pure UI/animation checks and do not require authentication or a
 * seeded database, so they run against the dev server with a no-op global setup.
 */

test.describe('Feature cards animation', () => {
  test('feature cards start hidden and reveal on scroll with staggered delay', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#features .reveal');

    // Ignore the heading reveal (index 0); assert on actual feature cards.
    const firstCard = cards.nth(1);
    const fourthCard = cards.nth(4);

    // Before scrolling, the card should be hidden (opacity 0).
    await expect(firstCard).toHaveCSS('opacity', '0');

    // Scroll the features section into view.
    await page.locator('#features').scrollIntoViewIfNeeded();

    // Both cards eventually become fully visible.
    await expect(firstCard).toHaveCSS('opacity', '1');
    await expect(fourthCard).toHaveCSS('opacity', '1');

    // The fourth card has a larger staggered animation delay than the first.
    const firstDelay = await firstCard.evaluate(el => getComputedStyle(el).animationDelay);
    const fourthDelay = await fourthCard.evaluate(el => getComputedStyle(el).animationDelay);
    expect(parseFloat(fourthDelay)).toBeGreaterThan(parseFloat(firstDelay));
  });

  test('feature card hover lifts and scales the card and icon', async ({ page }) => {
    await page.goto('/');
    await page.locator('#features').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);

    const card = page.locator('#features .reveal').nth(1).locator('> div');
    const icon = card.locator('> div').first();

    await expect(card).toHaveCSS('transform', 'none');

    const box = await card.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(400);

    // Card moves up ~6px and scales to 1.02.
    await expect(card).toHaveCSS('transform', 'matrix(1.02, 0, 0, 1.02, 0, -6)');
    // Icon scales ~1.06 and moves up ~2px.
    await expect(icon).toHaveCSS('transform', 'matrix(1.06, 0, 0, 1.06, 0, -2)');
    // Border shifts to the primary color.
    await expect(card).toHaveCSS('border-color', 'rgb(196, 181, 253)');
  });

  test('cards are visible immediately when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const firstCard = page.locator('#features .reveal').nth(1);
    await expect(firstCard).toHaveCSS('opacity', '1');
  });
});
