const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const btns = await page.locator('[data-testid="theme-toggle-btn"]').all();
  console.log('Found theme-toggle buttons:', btns.length);
  for (let i = 0; i < btns.length; i++) {
    const isVis = await btns[i].isVisible();
    const aria = await btns[i].getAttribute('aria-label');
    console.log(`Button ${i} visible: ${isVis}, aria: "${aria}"`);
  }

  if (btns.length > 0) {
    console.log('Clicking button 0...');
    await btns[0].click({ force: true });
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => ({
      className: document.documentElement.className,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('urplaced-theme'),
    }));
    console.log('After click 1:', state);

    console.log('Clicking button 0 again...');
    await btns[0].click({ force: true });
    await page.waitForTimeout(500);

    const state2 = await page.evaluate(() => ({
      className: document.documentElement.className,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('urplaced-theme'),
    }));
    console.log('After click 2:', state2);
  }

  await browser.close();
})();
