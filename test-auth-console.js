import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto("http://localhost:1420");
  
  // Try sign in
  await page.fill('input[type="email"]', 'test5@donebun.app');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  await browser.close();
})();
