import { test, expect } from '@playwright/test';

test('full auth flow: register -> logout -> login', async ({ page }) => {
  const uniqueUser = `e2e_${Date.now()}`;

  // Register
  await page.goto('http://localhost:3000/register');
  await page.fill('input[placeholder*="用户名"]', uniqueUser);
  await page.fill('input[placeholder*="昵称"]', 'E2E Test');
  await page.fill('input[placeholder*="密码"]', 'test123');
  await page.click('button:has-text("用户")');
  await page.click('button:has-text("注 册")');
  await page.waitForURL('**/profile');
  await expect(page.locator('text=个人中心')).toBeVisible();

  // Logout
  await page.click('button:has-text("退出登录")');
  await page.waitForURL('**/login');

  // Login
  await page.fill('input[placeholder="用户名"]', uniqueUser);
  await page.fill('input[placeholder="密码"]', 'test123');
  await page.click('button:has-text("登 录")');
  await page.waitForURL('**/profile');
  await expect(page.locator('text=个人中心')).toBeVisible();
});

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[placeholder="用户名"]', 'nobody');
  await page.fill('input[placeholder="密码"]', 'wrong');
  await page.click('button:has-text("登 录")');
  await expect(page.locator('text=用户名或密码错误')).toBeVisible({ timeout: 5000 });
});
