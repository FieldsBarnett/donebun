import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async response => {
    if (response.url().includes('/api/auth/')) {
      console.log('API URL:', response.url());
      console.log('API Status:', response.status());
      try {
        console.log('API Body:', await response.text());
      } catch(e) {}
    }
  });

  await page.goto("http://localhost:1420");
  
  // Try sign in
  await page.fill('input[type="email"]', 'test5@donebun.app');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  
  // check if we are on dashboard
  console.log('Final URL:', page.url());
  
  await browser.close();
})();
