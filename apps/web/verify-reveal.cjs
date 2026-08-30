const { chromium } = require('playwright');

async function run(label, opts) {
  const browser = await chromium.launch();
  const context = await browser.newContext(opts.context || {});
  const page = await context.newPage();
  if (opts.viewport) await page.setViewportSize(opts.viewport);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  const cards = page.locator('#features .reveal');
  const before = await cards.first().evaluate(el => getComputedStyle(el).opacity);
  // Don't scroll yet — confirm hidden
  console.log(`[${label}] before opacity:`, before);

  // Scroll and sample rapidly
  await page.locator('#features').scrollIntoViewIfNeeded();
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const o = await cards.first().evaluate(el => getComputedStyle(el).opacity);
    samples.push(Number(o).toFixed(2));
    await page.waitForTimeout(80);
  }
  console.log(`[${label}] opacity samples during/after:`, samples.join(' '));
  const cls = await cards.first().evaluate(el => el.className);
  console.log(`[${label}] class:`, cls);

  // Hover test on first card
  const box = await cards.first().boundingBox();
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.waitForTimeout(400);
  const hoverTransform = await cards.first().evaluate(el => getComputedStyle(el).transform);
  console.log(`[${label}] card transform on hover:`, hoverTransform);

  console.log(`[${label}] pageerrors:`, JSON.stringify(errors));
  await browser.close();
}

(async () => {
  await run('desktop-1280', { viewport: { width: 1280, height: 800 } });
  await run('mobile-390', { viewport: { width: 390, height: 844 } });
  await run('reduced-motion', { context: { reducedMotion: 'reduce' }, viewport: { width: 1280, height: 800 } });
})();
