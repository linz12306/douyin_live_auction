import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const password = 'test123';
const imagePath = '/favicon.svg';

test.describe.configure({ retries: 0 });

interface AuthUser {
  id: number;
  username: string;
  role: 'merchant' | 'user';
  display_name: string;
}

interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface ProductDetail {
  product: { id: number };
  auction: { id: number };
}

async function readData(response: APIResponse) {
  const body = await response.json();
  return body.data;
}

async function register(api: APIRequestContext, username: string, role: AuthUser['role'], displayName: string): Promise<AuthResult> {
  const response = await api.post('/api/v1/auth/register', {
    data: {
      username,
      password,
      role,
      display_name: displayName,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const data = await readData(response);
  return {
    user: data.user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

async function authorizedPost(api: APIRequestContext, path: string, token: string, data?: Record<string, unknown>) {
  const response = await api.post(path, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response;
}

async function tryAuthorizedPost(api: APIRequestContext, path: string, token: string, data?: Record<string, unknown>) {
  return api.post(path, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function createActiveAuction(api: APIRequestContext, merchant: AuthResult, title: string) {
  const createResponse = await authorizedPost(api, '/api/v1/products', merchant.accessToken, {
    title,
    description: 'Realtime E2E product',
    image_urls: [imagePath],
  });
  const created = await readData(createResponse) as ProductDetail;
  const productId = created.product.id;

  const publishResponse = await authorizedPost(api, `/api/v1/products/${productId}/publish`, merchant.accessToken, {
    start_price: 100,
    bid_increment_type: 'fixed',
    bid_increment_value: 25,
    ceiling_price: 175,
    duration_seconds: 300,
    auto_extend_seconds: 15,
    max_extend_count: 5,
  });
  const published = await readData(publishResponse) as ProductDetail;
  const auctionId = published.auction.id;

  await authorizedPost(api, `/api/v1/auctions/${auctionId}/activate`, merchant.accessToken);
  return { productId, auctionId };
}

async function seedAuth(context: BrowserContext, baseURL: string, auth: AuthResult) {
  await context.addInitScript(({ origin, refreshToken, user }) => {
    if (window.location.origin !== origin) return;
    window.localStorage.setItem('refresh_token', refreshToken);
    window.localStorage.setItem('auth_user', JSON.stringify(user));
  }, {
    origin: new URL(baseURL).origin,
    refreshToken: auth.refreshToken,
    user: auth.user,
  });
}

async function enterLiveRoomFromLobby(page: Page, auctionId: number, title: string) {
  await page.goto('/app/auctions');
  const card = page.locator('article').filter({ hasText: title });
  await expect(card).toContainText('¥0.00');
  await card.getByRole('link', { name: '进入直播间' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/auctions/${auctionId}$`));
}

async function openBidSheet(page: Page) {
  await page.getByRole('button', { name: '打开出价面板' }).click();
  await expect(page.getByRole('dialog', { name: '竞拍出价' })).toBeVisible();
}

test('live room streams snapshot, bids, outbid notice, countdown, and terminal auction_end', async ({ browser, baseURL }) => {
  const api = await playwrightRequest.newContext({ baseURL });
  const unique = Date.now().toString(36);
  const title = `Realtime E2E Lot ${unique}`;

  const merchant = await register(api, `rtm_${unique}`, 'merchant', 'E2E Merchant');
  const userA = await register(api, `rta_${unique}`, 'user', 'User Alpha');
  const userB = await register(api, `rtb_${unique}`, 'user', 'User Beta');
  const { auctionId } = await createActiveAuction(api, merchant, title);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await seedAuth(contextA, baseURL!, userA);
  await seedAuth(contextB, baseURL!, userB);

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await enterLiveRoomFromLobby(pageA, auctionId, title);
    await expect(pageA.getByRole('heading', { name: title })).toBeVisible();
    await expect(pageA.locator('text=当前价').locator('..')).toContainText('¥0.00');
    const countdown = pageA.locator('text=倒计时').locator('..');
    await expect(countdown).toContainText(/0[1-5]:[0-5]\d/);
    const initialCountdown = await countdown.textContent();
    await expect.poll(() => countdown.textContent(), { timeout: 6500 }).not.toBe(initialCountdown);
    await openBidSheet(pageA);
    await expect(pageA.getByRole('button', { name: '立即出价 ¥125.00' })).toBeEnabled();

    await pageA.getByRole('button', { name: '立即出价 ¥125.00' }).click();
    await expect(pageA.locator('text=当前价').locator('..')).toContainText('¥125.00');
    await expect(pageA.locator('body')).toContainText('User Alpha');

    await pageB.goto(`/app/auctions/${auctionId}`);
    await expect(pageB.getByRole('heading', { name: title })).toBeVisible();
    await expect(pageB.locator('text=当前价').locator('..')).toContainText('¥125.00');
    await openBidSheet(pageB);
    await pageB.getByRole('button', { name: '立即出价 ¥150.00' }).click();

    await expect(pageA.locator('body')).toContainText('您已被超过，当前最高出价为 150');
    await expect(pageA.locator('text=当前价').locator('..')).toContainText('¥150.00');
    await expect(pageA.locator('body')).toContainText('User Beta');
    await expect(pageA.locator('body')).toContainText('¥150.00');

    await pageA.getByRole('button', { name: '立即追回 ¥175.00' }).click();
    await expect(pageA.locator('text=当前价').locator('..')).toContainText('¥175.00');
    await expect(pageA.locator('span').filter({ hasText: '已成交' })).toBeVisible();
    await expect(pageA.locator('body')).toContainText('竞拍已结束');
    await expect(pageA.getByRole('button', { name: '竞拍已结束' })).toBeDisabled();
    await expect(pageA.getByRole('button', { name: '确认自定义出价' })).toBeDisabled();
  } finally {
    await tryAuthorizedPost(api, `/api/v1/auctions/${auctionId}/bid`, userA.accessToken, { amount: 175 });
    await contextA.close();
    await contextB.close();
    await api.dispose();
  }
});
