const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const outDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1586, height: 950 },
  });

  const page = await context.newPage();

  // 1. Go to login page
  console.log('Navigating to login page on http://127.0.0.1:5173/login ...');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Click Buyer demo button, then click Sign In
  console.log('Filling Buyer credentials and signing in...');
  const buyerBtn = page.locator('button:has-text("Buyer")');
  await buyerBtn.click();
  await page.waitForTimeout(500);

  const signInBtn = page.locator('button:has-text("Sign In")');
  await signInBtn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 1. Capture Dashboard v1 (Hero with 4 Stacked Rows & Overlapping KPIs)
  console.log('Capturing dashboard v1 (Hero + 4 Stacked Rows + Overlapping KPIs)...');
  const dashPath1 = path.join(outDir, 'dashboard_v1.png');
  await page.screenshot({ path: dashPath1, fullPage: false });

  // 2. Capture Dashboard v2 (Scroll down to Recommended Suppliers & Insights)
  console.log('Capturing dashboard v2 (Suppliers & Market Insights)...');
  await page.evaluate(() => window.scrollBy(0, 650));
  await page.waitForTimeout(1500);
  const dashPath2 = path.join(outDir, 'dashboard_v2.png');
  await page.screenshot({ path: dashPath2, fullPage: false });

  // 3. Capture Dashboard v3 (Full Page Overview)
  console.log('Capturing dashboard v3 (Full Page)...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  const dashPath3 = path.join(outDir, 'dashboard_v3.png');
  await page.screenshot({ path: dashPath3, fullPage: true });

  // 4. Capture Analytics Market tab
  console.log('Navigating to /analytics...');
  await page.goto('http://127.0.0.1:5173/analytics', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const analyticsPath1 = path.join(outDir, 'analytics_v1.png');
  await page.screenshot({ path: analyticsPath1, fullPage: false });

  // 5. Click Trade Operations tab and capture
  console.log('Clicking Trade Operations tab on /analytics...');
  const opsTab = page.locator('button:has-text("Trade Operations & Performance")');
  if (await opsTab.isVisible()) {
    await opsTab.click();
    await page.waitForTimeout(2000);
  }
  const analyticsPath2 = path.join(outDir, 'analytics_v2.png');
  await page.screenshot({ path: analyticsPath2, fullPage: false });
  console.log('Saved:', analyticsPath2);

  await browser.close();
  console.log('All screenshots captured successfully at 1586px width!');
}

capture().catch((err) => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
