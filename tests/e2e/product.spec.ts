import { test, expect } from '@playwright/test';

test('merchant creates product draft and publishes', async ({ page }) => {
  const uniqueUser = `merch_${Date.now()}`;

  // Register merchant
  await page.goto('http://localhost:3000/register');
  await page.fill('input[placeholder*="用户名"]', uniqueUser);
  await page.fill('input[placeholder*="昵称"]', 'Merchant Test');
  await page.fill('input[placeholder*="密码"]', 'test123');
  await page.click('button:has-text("商家")');
  await page.click('button:has-text("注 册")');
  await page.waitForURL('**/profile');

  // Navigate to product list
  await page.goto('http://localhost:3000/merchant/products');
  await expect(page.locator('text=商品管理')).toBeVisible();

  // Create new product
  await page.click('a:has-text("新建竞拍")');
  await expect(page.locator('text=新建竞拍')).toBeVisible();

  await page.fill('input[placeholder="商品名称"]', 'E2E Test Product');
  await page.click('button:has-text("创建草稿")');
  await page.waitForURL('**/merchant/products');
  await expect(page.locator('text=E2E Test Product')).toBeVisible();
});
