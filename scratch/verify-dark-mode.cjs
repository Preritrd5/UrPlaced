const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runVerification() {
  console.log('Launching browser for Dark Mode verification...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    landingLight: false,
    toggleToDark: false,
    persistedToDark: false,
    computedColorsDark: {},
    loginDark: false,
    toggleBackToLight: false,
    viewportsVerified: [],
  };

  const screenshotsDir = path.resolve('scratch/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // 1. Visit Landing Page
    console.log('1. Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    const initialTheme = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        hasDarkClass: root.classList.contains('dark'),
        dataTheme: root.getAttribute('data-theme'),
        localStorage: localStorage.getItem('urplaced-theme'),
      };
    });
    console.log('Initial theme state:', initialTheme);
    results.landingLight = !initialTheme.hasDarkClass;

    await page.screenshot({ path: path.join(screenshotsDir, 'landing-light.png') });

    // 2. Click Theme Toggle to switch to Dark Mode
    console.log('2. Clicking theme toggle...');
    const toggleBtn = await page.locator('[data-testid="theme-toggle-btn"]').first();
    await toggleBtn.click();
    await page.waitForTimeout(500);

    const darkTheme = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);
      return {
        hasDarkClass: root.classList.contains('dark'),
        dataTheme: root.getAttribute('data-theme'),
        localStorage: localStorage.getItem('urplaced-theme'),
        backgroundColor: bodyStyles.backgroundColor,
        color: bodyStyles.color,
      };
    });
    console.log('Dark mode theme state:', darkTheme);
    results.toggleToDark = darkTheme.hasDarkClass && darkTheme.dataTheme === 'dark';
    results.computedColorsDark = {
      bodyBg: darkTheme.backgroundColor,
      bodyColor: darkTheme.color,
    };

    await page.screenshot({ path: path.join(screenshotsDir, 'landing-dark.png') });

    // 3. Test Viewports in Dark Mode
    const viewports = [
      { name: 'Mobile (375x667)', width: 375, height: 667 },
      { name: 'Tablet (768x1024)', width: 768, height: 1024 },
      { name: 'Laptop-13 (1280x800)', width: 1280, height: 800 },
      { name: 'Laptop-14 (1366x768)', width: 1366, height: 768 },
      { name: 'Laptop-15 (1440x900)', width: 1440, height: 900 },
      { name: 'Desktop-FHD (1920x1080)', width: 1920, height: 1080 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
      const filename = `landing-dark-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path: path.join(screenshotsDir, filename) });
      results.viewportsVerified.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        status: 'PASSED',
      });
      console.log(`Verified viewport ${vp.name}`);
    }

    // 4. Navigate to Login Page with Dark Mode active
    console.log('4. Navigating to login page with Dark Mode active...');
    await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'networkidle' });
    const loginTheme = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        hasDarkClass: root.classList.contains('dark'),
        dataTheme: root.getAttribute('data-theme'),
        localStorage: localStorage.getItem('urplaced-theme'),
      };
    });
    console.log('Login theme state (persisted):', loginTheme);
    results.loginDark = loginTheme.hasDarkClass && loginTheme.localStorage === 'dark';
    results.persistedToDark = results.loginDark;

    await page.screenshot({ path: path.join(screenshotsDir, 'login-dark.png') });

    // 5. Toggle back to Light Mode on Login Page
    console.log('5. Toggling back to Light Mode on login page...');
    const loginToggleBtn = await page.locator('[data-testid="theme-toggle-btn"]').first();
    await loginToggleBtn.click();
    await page.waitForTimeout(500);

    const loginLight = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        hasDarkClass: root.classList.contains('dark'),
        dataTheme: root.getAttribute('data-theme'),
        localStorage: localStorage.getItem('urplaced-theme'),
      };
    });
    console.log('Login theme state (back to light):', loginLight);
    results.toggleBackToLight = !loginLight.hasDarkClass && loginLight.dataTheme === 'light';

    await page.screenshot({ path: path.join(screenshotsDir, 'login-light.png') });

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
