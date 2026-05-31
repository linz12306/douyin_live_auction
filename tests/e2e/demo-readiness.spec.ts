import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
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

async function createActiveAuction(api: APIRequestContext, merchant: AuthResult, title: string) {
  const createResponse = await authorizedPost(api, '/api/v1/products', merchant.accessToken, {
    title,
    description: 'Demo readiness product',
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

test('presenter demo journey covers live auction, monitor, settlement, and payment', async ({ browser, baseURL }) => {
  const api = await playwrightRequest.newContext({ baseURL });
  const unique = Date.now().toString(36);
  const title = `Demo Readiness Lot ${unique}`;

  const merchant = await register(api, `demom_${unique}`, 'merchant', 'Demo Merchant');
  const buyerA = await register(api, `demoa_${unique}`, 'user', 'Demo Buyer A');
  const buyerB = await register(api, `demob_${unique}`, 'user', 'Demo Buyer B');
  const { auctionId } = await createActiveAuction(api, merchant, title);

  const merchantContext = await browser.newContext();
  const buyerAContext = await browser.newContext();
  const buyerBContext = await browser.newContext();
  await seedAuth(merchantContext, baseURL!, merchant);
  await seedAuth(buyerAContext, baseURL!, buyerA);
  await seedAuth(buyerBContext, baseURL!, buyerB);

  const merchantPage = await merchantContext.newPage();
  const buyerAPage = await buyerAContext.newPage();
  const buyerBPage = await buyerBContext.newPage();

  try {
    await merchantPage.goto('/merchant/dashboard');
    await expect(merchantPage.locator('body')).toContainText(title);

    await merchantPage.locator('a[href="/merchant/products"]').first().click();
    const merchantProduct = merchantPage.locator('article').filter({ hasText: title });
    await expect(merchantProduct).toBeVisible();
    await merchantProduct.locator(`a[href="/merchant/auctions/${auctionId}/monitor"]`).click();
    await expect(merchantPage.getByRole('heading', { name: title })).toBeVisible();
    await expect(merchantPage.locator('body')).toContainText(/[¥楼]0\.00/);

    await buyerAPage.goto('/app/auctions');
    const auctionCard = buyerAPage.locator('article').filter({ hasText: title });
    await expect(auctionCard).toBeVisible();
    await auctionCard.getByRole('link').click();
    await expect(buyerAPage).toHaveURL(new RegExp(`/app/auctions/${auctionId}$`));
    await expect(buyerAPage.getByRole('heading', { name: title })).toBeVisible();

    await buyerAPage.getByRole('button', { name: /125/ }).click();
    await expect(buyerAPage.locator('body')).toContainText(/[¥楼]125\.00/);
    await expect(merchantPage.locator('body')).toContainText(/[¥楼]125\.00/);

    await buyerBPage.goto(`/app/auctions/${auctionId}`);
    await expect(buyerBPage.getByRole('heading', { name: title })).toBeVisible();
    await buyerBPage.getByRole('button', { name: /150/ }).click();

    await expect(buyerAPage.locator('body')).toContainText(/[¥楼]150\.00/);
    await expect(buyerAPage.locator('body')).toContainText(/您已被超过|鎮ㄥ凡琚/);
    await expect(merchantPage.locator('body')).toContainText(/[¥楼]150\.00/);

    await buyerAPage.getByRole('button', { name: /175/ }).click();
    await expect(buyerAPage.locator('body')).toContainText(/[¥楼]175\.00/);
    await expect(buyerAPage.locator('body')).toContainText(/已成交|宸叉垚浜/);

    await buyerAPage.locator('a[href="/app/orders"]').click();
    const orderCard = buyerAPage.locator('article').filter({ hasText: title });
    await expect(orderCard).toBeVisible();
    await orderCard.getByRole('link').click();
    await buyerAPage.getByRole('button', { name: /确认订单|纭|确/ }).click();
    await buyerAPage.getByRole('button', { name: /模拟支付|妯|模拟/ }).click();
    await expect(buyerAPage.locator('body')).toContainText(/已支付|宸叉敮浠/);
  } finally {
    await merchantContext.close();
    await buyerAContext.close();
    await buyerBContext.close();
    await api.dispose();
  }
});
