const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@ybyvibe.com');
  await page.fill('input[type="password"]', 'manage');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  await page.goto('http://localhost:5173/event/279');
  await page.waitForTimeout(2000);
  console.log('Clicking slot...');
  await page.locator('.time-slot-card').first().click();
  await page.waitForTimeout(1000);
  console.log('Checking button state...');
  const btn = page.locator('button:has-text("Complete Registration")');
  if (await btn.count() > 0) {
    console.log('Button found, disabled:', await btn.isDisabled());
    try {
        await btn.click({ timeout: 2000 });
        console.log('CLICKED with playwright click()');
    } catch (e) {
      console.log('CLICK ERROR:', e.message);
      // Let's try to check what is intercepting the click
      const interceptingElement = await page.evaluate(async () => {
        const btn = document.querySelector('button.action-btn.primary-btn');
        const rect = btn.getBoundingClientRect();
        const el = document.elementFromPoint(rect.x + rect.width/2, rect.y + rect.height/2);
        return el ? el.className + ' ' + el.tagName : 'none';
      });
      console.log('Element intercepting click:', interceptingElement);
    }
  } else {
    console.log('Button not found');
  }
  await page.waitForTimeout(1500);
  await browser.close();
})();
