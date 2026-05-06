import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (response) => {
    if (response.url().includes('/api/auth/')) {
      console.log('Response URL:', response.url());
      console.log('Response Status:', response.status());
      try {
        console.log('Response Body:', await response.text());
      } catch (e) {
        console.log('Could not read body');
      }
    }
  });

  await page.goto("http://localhost:1420");
  
  // Try sign up
  await page.click('text="Need an account? Sign up"');
  await page.fill('input[type="email"]', 'test5@donebun.app');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);
  await browser.close();
})();
