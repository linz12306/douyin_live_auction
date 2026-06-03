import { pathToFileURL } from 'node:url';

const baseURL = process.env.DEMO_API_BASE_URL ?? 'http://127.0.0.1:8080';
const password = process.env.DEMO_PASSWORD ?? 'test123';
export const demoImagePath = '/static/images/demo-auction-product.svg';
const runId = process.env.DEMO_RUN_ID ?? Date.now().toString(36);

const accounts = {
  merchant: { username: 'demo_merchant', role: 'merchant', display_name: 'Demo Merchant' },
  buyerA: { username: 'demo_buyer_a', role: 'user', display_name: 'Demo Buyer A' },
  buyerB: { username: 'demo_buyer_b', role: 'user', display_name: 'Demo Buyer B' },
};

async function request(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  return body.data;
}

async function registerOrLogin(account) {
  const response = await fetch(`${baseURL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...account, password }),
  });

  if (response.ok) {
    const body = await response.json();
    assertExpectedRole(body.data, account);
    return body.data;
  }

  const loginResult = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: account.username, password }),
  });
  assertExpectedRole(loginResult, account);
  return loginResult;
}

function getReturnedRole(authResult) {
  return authResult?.user?.role ?? authResult?.role;
}

export function assertExpectedRole(authResult, account) {
  const actualRole = getReturnedRole(authResult);
  if (actualRole !== account.role) {
    throw new Error(
      `${account.username} expected role ${account.role}, got ${actualRole ?? 'unknown'}. ` +
      'Reset or fix the existing demo account before seeding.',
    );
  }
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createActiveAuction(merchantToken, title) {
  const created = await request('/api/v1/products', {
    method: 'POST',
    headers: auth(merchantToken),
    body: JSON.stringify({
      title,
      description: 'Local demo auction product',
      image_urls: [demoImagePath],
    }),
  });
  const productId = created.product.id;

  const published = await request(`/api/v1/products/${productId}/publish`, {
    method: 'POST',
    headers: auth(merchantToken),
    body: JSON.stringify({
      start_price: 100,
      bid_increment_type: 'fixed',
      bid_increment_value: 25,
      ceiling_price: 175,
      duration_seconds: 300,
      auto_extend_seconds: 15,
      max_extend_count: 5,
    }),
  });
  const auctionId = published.auction.id;

  await request(`/api/v1/auctions/${auctionId}/activate`, {
    method: 'POST',
    headers: auth(merchantToken),
  });

  return { productId, auctionId };
}

async function main() {
  await request('/healthz');

  const merchant = await registerOrLogin(accounts.merchant);
  const buyerA = await registerOrLogin(accounts.buyerA);
  const buyerB = await registerOrLogin(accounts.buyerB);
  const title = `Demo Auction ${runId}`;
  const auction = await createActiveAuction(merchant.access_token, title);

  const result = {
    baseURL,
    runId,
    password,
    title,
    auction,
    accounts: {
      merchant: { username: accounts.merchant.username, role: 'merchant' },
      buyerA: { username: accounts.buyerA.username, role: 'user' },
      buyerB: { username: accounts.buyerB.username, role: 'user' },
    },
    routes: {
      dashboard: '/merchant/dashboard',
      monitor: `/merchant/auctions/${auction.auctionId}/monitor`,
      lobby: '/app/auctions',
      liveRoom: `/app/auctions/${auction.auctionId}`,
      buyerOrders: '/app/orders',
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
