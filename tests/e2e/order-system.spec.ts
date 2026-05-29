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

async function createWonOrder(api: APIRequestContext, merchant: AuthResult, buyer: AuthResult, title: string) {
  const createResponse = await authorizedPost(api, '/api/v1/products', merchant.accessToken, {
    title,
    description: 'Order E2E product',
    image_urls: [imagePath],
  });
  const created = await readData(createResponse) as ProductDetail;
  const productId = created.product.id;

  const publishResponse = await authorizedPost(api, `/api/v1/products/${productId}/publish`, merchant.accessToken, {
    start_price: 0,
    bid_increment_type: 'fixed',
    bid_increment_value: 10,
    ceiling_price: 20,
    duration_seconds: 300,
    auto_extend_seconds: 15,
    max_extend_count: 5,
  });
  const published = await readData(publishResponse) as ProductDetail;
  const auctionId = published.auction.id;

  await authorizedPost(api, `/api/v1/auctions/${auctionId}/activate`, merchant.accessToken);
  await authorizedPost(api, `/api/v1/auctions/${auctionId}/bid`, buyer.accessToken, { amount: 20 });
  return { auctionId };
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

test('buyer confirms and pays a won auction order', async ({ browser, baseURL }) => {
  const api = await playwrightRequest.newContext({ baseURL });
  const unique = Date.now().toString(36);
  const title = `Order E2E Lot ${unique}`;

  const merchant = await register(api, `ordm_${unique}`, 'merchant', 'Order Merchant');
  const buyer = await register(api, `ordb_${unique}`, 'user', 'Order Buyer');
  await createWonOrder(api, merchant, buyer, title);

  const context = await browser.newContext();
  await seedAuth(context, baseURL!, buyer);
  const page = await context.newPage();

  try {
    await page.goto('/app/orders');
    const orderCard = page.locator('article').filter({ hasText: title });
    await expect(orderCard).toContainText('待确认');
    await expect(orderCard).toContainText('¥20.00');
    await orderCard.getByRole('link', { name: '查看详情' }).click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('待确认')).toBeVisible();
    await page.getByRole('button', { name: '确认订单' }).click();

    await expect(page.getByText('待支付')).toBeVisible();
    await page.getByRole('button', { name: '模拟支付' }).click();

    await expect(page.getByText('已支付')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认订单' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '模拟支付' })).toHaveCount(0);
  } finally {
    await context.close();
    await api.dispose();
  }
});
