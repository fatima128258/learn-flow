const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.locator('#features').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  // The actual FeatureCard Card element is the direct child of the reveal wrapper (skip heading)
  const card = page.locator('#features .reveal').nth(1).locator('> div');
  const icon = card.locator('> div').first();

  const beforeCard = await card.evaluate(el => getComputedStyle(el).transform);
  const beforeIcon = await icon.evaluate(el => getComputedStyle(el).transform);
  const beforeBorder = await card.evaluate(el => getComputedStyle(el).borderColor);

  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.waitForTimeout(400);

  const afterCard = await card.evaluate(el => getComputedStyle(el).transform);
  const afterIcon = await icon.evaluate(el => getComputedStyle(el).transform);
  const afterBorder = await card.evaluate(el => getComputedStyle(el).borderColor);
  const cardTransition = await card.evaluate(el => getComputedStyle(el).transitionDuration + ' / ' + getComputedStyle(el).transitionProperty);

  console.log('CARD transform before hover:', beforeCard);
  console.log('CARD transform after  hover:', afterCard);
  console.log('ICON transform before hover:', beforeIcon);
  console.log('ICON transform after  hover:', afterIcon);
  console.log('BORDER before/after hover:', beforeBorder, '->', afterBorder);
  console.log('CARD transition:', cardTransition);

  await browser.close();
})();
