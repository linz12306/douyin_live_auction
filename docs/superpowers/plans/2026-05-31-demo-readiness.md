# demo-readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable local demonstration workflow for the current auction MVP, including demo data setup, a full browser readiness journey, a presenter runbook, and only narrow demo-blocking polish.

**Architecture:** Keep demo setup outside production request paths by adding a root-level Node script that calls existing HTTP APIs. Reuse the current Playwright setup and existing app routes for end-to-end verification, then document the exact presenter path in a runbook.

**Tech Stack:** Node.js ESM script with built-in `fetch`, Playwright, Go/Gin backend APIs, React/Vite frontend, OpenSpec, Docker MySQL/Redis.

---

## Scope Decision

This plan does not add new auction, order, wallet, payment, livestream, or analytics semantics. It packages existing implemented capabilities into a reliable local demo.

The implementation should run in this order:

1. Archive accepted merchant OpenSpec changes so the demo baseline is clean.
2. Add repeatable demo seed support through existing HTTP APIs.
3. Add one combined Playwright demo-readiness journey.
4. Fix only demo blockers discovered by the E2E path.
5. Add a presenter runbook and final verification/memory updates.

## File Map

- Create: `scripts/demo-seed.mjs`
  - Local-only data setup script. It registers or logs in demo accounts, creates a uniquely named product, publishes and activates an auction, and optionally creates an order-ready auction.
- Modify: `package.json`
  - Add root scripts for demo seed and demo E2E.
- Create: `tests/e2e/demo-readiness.spec.ts`
  - Combined presenter journey across merchant, buyer A, bidder B, monitor, settlement, order confirmation, and simulated payment.
- Create: `docs/demo-readiness.md`
  - Presenter runbook with exact commands, accounts, route sequence, checkpoints, and troubleshooting.
- Modify as needed after E2E reveals blockers:
  - `frontend/src/pages/merchant/Dashboard.tsx`
  - `frontend/src/pages/merchant/AuctionMonitor.tsx`
  - `frontend/src/pages/merchant/ProductList.tsx`
  - `frontend/src/pages/merchant/ProductDetail.tsx`
  - `frontend/src/pages/app/LiveAuctionRoom.tsx`
  - `frontend/src/pages/app/OrderList.tsx`
  - `frontend/src/pages/app/OrderDetail.tsx`
- Test files for any blocker fixes:
  - Existing nearby `*.test.tsx` files beside the affected page, or a new focused test if none exists.
- Modify: `openspec/changes/demo-readiness/tasks.md`
  - Keep task status synchronized.
- Modify: `docs/superpowers/plans/2026-05-31-demo-readiness.md`
  - Record actual verification results during execution.
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-05-31.md`
  - Record final state, decisions, risks, and next step.
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`
  - Record stable demo commands and branch/archive state.

## Task 1: Preflight And Accepted Change Cleanup

**Files:**
- Modify: `openspec/changes/demo-readiness/tasks.md`
- Modify: `docs/superpowers/plans/2026-05-31-demo-readiness.md`
- May move by command: `openspec/changes/merchant-dashboard/`
- May move by command: `openspec/changes/merchant-auction-monitor/`
- May modify by command: `openspec/specs/`

- [ ] **Step 1: Confirm branch and clean worktree**

Run:

```powershell
git status --short --branch
git log -1 --oneline
```

Expected:

```text
## codex/demo-readiness...origin/codex/demo-readiness
863f9f9 docs(demo): lock demo readiness spec
```

- [ ] **Step 2: Validate current OpenSpec changes**

Run:

```powershell
openspec validate demo-readiness --strict
openspec validate merchant-dashboard --strict
openspec validate merchant-auction-monitor --strict
```

Expected:

```text
Change 'demo-readiness' is valid
Change 'merchant-dashboard' is valid
Change 'merchant-auction-monitor' is valid
```

- [ ] **Step 3: Archive accepted merchant changes**

The merchant dashboard and merchant auction monitor changes are already implemented and present on current `master`; archive them before completing demo-readiness so the persistent specs reflect the code baseline.

Run:

```powershell
openspec archive merchant-dashboard --yes
openspec archive merchant-auction-monitor --yes
openspec validate --specs --strict
```

Expected:

```text
Change 'merchant-dashboard' archived ...
Change 'merchant-auction-monitor' archived ...
Totals: ... passed, 0 failed
```

- [ ] **Step 4: Commit archive cleanup**

Run:

```powershell
git diff --check
git status --short
git add openspec/changes openspec/specs docs/superpowers/plans/2026-05-31-demo-readiness.md openspec/changes/demo-readiness/tasks.md
git commit -m "docs(openspec): archive accepted merchant changes"
git push
```

Expected:

```text
[codex/demo-readiness <sha>] docs(openspec): archive accepted merchant changes
```

Task 1 result: completed. `demo-readiness`, `merchant-dashboard`, and `merchant-auction-monitor` strict validation passed. `merchant-dashboard` was archived as `2026-05-31-merchant-dashboard`, `merchant-auction-monitor` was archived as `2026-05-31-merchant-auction-monitor`, and `openspec validate --specs --strict` passed with six specs.

## Task 2: Demo Seed Script

**Files:**
- Create: `scripts/demo-seed.mjs`
- Modify: `package.json`
- Test manually through backend HTTP APIs.

- [ ] **Step 1: Add failing script command**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "demo:seed": "node scripts/demo-seed.mjs",
    "test:e2e:demo": "npx playwright test tests/e2e/demo-readiness.spec.ts"
  }
}
```

Keep any existing scripts not related to this change.

Run:

```powershell
npm run demo:seed
```

Expected before creating the script:

```text
Error: Cannot find module ... scripts/demo-seed.mjs
```

- [ ] **Step 2: Create the demo seed script**

Create `scripts/demo-seed.mjs` with this behavior:

```javascript
const baseURL = process.env.DEMO_API_BASE_URL ?? 'http://127.0.0.1:8080';
const password = process.env.DEMO_PASSWORD ?? 'test123';
const imagePath = '/favicon.svg';
const runId = process.env.DEMO_RUN_ID ?? Date.now().toString(36);

const accounts = {
  merchant: { username: 'demo_merchant', role: 'merchant', display_name: '演示商家' },
  buyerA: { username: 'demo_buyer_a', role: 'user', display_name: '演示买家A' },
  buyerB: { username: 'demo_buyer_b', role: 'user', display_name: '演示买家B' },
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
  const payload = { ...account, password };
  const response = await fetch(`${baseURL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.ok) {
    const body = await response.json();
    return body.data;
  }

  return request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: account.username, password }),
  });
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
      description: '本地演示商品',
      image_urls: [imagePath],
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
      duration_seconds: 600,
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
  const merchant = await registerOrLogin(accounts.merchant);
  const buyerA = await registerOrLogin(accounts.buyerA);
  const buyerB = await registerOrLogin(accounts.buyerB);
  const title = `演示竞拍 ${runId}`;
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
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Run the seed against the local backend**

Run:

```powershell
$env:DEMO_API_BASE_URL='http://127.0.0.1:8080'
npm run demo:seed
```

Expected:

```json
{
  "baseURL": "http://127.0.0.1:8080",
  "runId": "...",
  "password": "test123",
  "title": "演示竞拍 ...",
  "auction": {
    "productId": 1,
    "auctionId": 1
  },
  "accounts": {
    "merchant": { "username": "demo_merchant", "role": "merchant" },
    "buyerA": { "username": "demo_buyer_a", "role": "user" },
    "buyerB": { "username": "demo_buyer_b", "role": "user" }
  }
}
```

Exact ids vary. The command must exit `0`.

- [ ] **Step 4: Commit seed script**

Run:

```powershell
git diff --check
git add package.json scripts/demo-seed.mjs
git commit -m "chore(demo): add local seed script"
git push
```

Expected:

```text
[codex/demo-readiness <sha>] chore(demo): add local seed script
```

Task 2 result: completed. `npm run demo:seed` first failed as expected before `scripts/demo-seed.mjs` existed. After adding the script, the first real run exposed the backend duration rule, so the demo auction duration was corrected to `300`. The verified run against `http://127.0.0.1:8080` created/logged into `demo_merchant`, `demo_buyer_a`, and `demo_buyer_b`, then created active auction `1281` for product `1476`.

## Task 3: Combined Demo-Readiness E2E

**Files:**
- Create: `tests/e2e/demo-readiness.spec.ts`
- Modify if needed: `package.json`

- [ ] **Step 1: Write the failing Playwright test**

Create `tests/e2e/demo-readiness.spec.ts`. Start from the helper style in `tests/e2e/realtime-live-room.spec.ts` and `tests/e2e/order-system.spec.ts`.

The test must include:

```typescript
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
```

The test body must cover:

```typescript
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
    await expect(merchantPage.getByRole('heading')).toContainText(/看板|Dashboard|数据/);

    await merchantPage.goto(`/merchant/auctions/${auctionId}/monitor`);
    await expect(merchantPage.getByRole('heading', { name: title })).toBeVisible();

    await buyerAPage.goto('/app/auctions');
    await buyerAPage.locator('article').filter({ hasText: title }).getByRole('link').click();
    await expect(buyerAPage.getByRole('heading', { name: title })).toBeVisible();
    await buyerAPage.getByRole('button', { name: /125/ }).click();
    await expect(buyerAPage.locator('body')).toContainText('125');

    await buyerBPage.goto(`/app/auctions/${auctionId}`);
    await expect(buyerBPage.getByRole('heading', { name: title })).toBeVisible();
    await buyerBPage.getByRole('button', { name: /150/ }).click();

    await expect(buyerAPage.locator('body')).toContainText('150');
    await expect(buyerAPage.locator('body')).toContainText(/被超过|outbid/);
    await expect(merchantPage.locator('body')).toContainText('150');

    await buyerAPage.getByRole('button', { name: /175/ }).click();
    await expect(buyerAPage.locator('body')).toContainText(/已成交|ended/);

    await buyerAPage.goto('/app/orders');
    const orderCard = buyerAPage.locator('article').filter({ hasText: title });
    await orderCard.getByRole('link').click();
    await buyerAPage.getByRole('button', { name: /确认订单/ }).click();
    await buyerAPage.getByRole('button', { name: /模拟支付/ }).click();
    await expect(buyerAPage.locator('body')).toContainText(/已支付|paid/);
  } finally {
    await merchantContext.close();
    await buyerAContext.close();
    await buyerBContext.close();
    await api.dispose();
  }
});
```

Use the exact visible text that exists in the current app if the regex labels above are too broad or do not match.

- [ ] **Step 2: Run the E2E and record the first failure**

Run against existing local services first:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
npx playwright test tests/e2e/demo-readiness.spec.ts --project=chromium
```

Expected before blocker fixes: the test may fail at the first missing/unstable demo checkpoint. Record the exact failure in `docs/superpowers/plans/2026-05-31-demo-readiness.md` under a `Task 3 Result` note.

- [ ] **Step 3: Run existing E2E smoke tests**

Run:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
npx playwright test tests/e2e/realtime-live-room.spec.ts tests/e2e/order-system.spec.ts --project=chromium
```

Expected: existing tests either pass or reveal an environment issue. Do not change assertions until the failure is understood.

- [ ] **Step 4: Commit the initial E2E**

Commit the test even if it exposed a real blocker that will be fixed in Task 4, only if the failure is recorded and the test code itself is valid.

Run:

```powershell
git diff --check
git add tests/e2e/demo-readiness.spec.ts docs/superpowers/plans/2026-05-31-demo-readiness.md
git commit -m "test(demo): add readiness journey"
git push
```

Expected:

```text
[codex/demo-readiness <sha>] test(demo): add readiness journey
```

Task 3 result: completed. The first run with `--project=chromium` failed because this repository's Playwright config does not define named projects. The correct command is `PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npx playwright test tests/e2e/demo-readiness.spec.ts`. The next local run against the default `3000/8080` services hit registration rate limiting, so the verified run used backend `SERVER_PORT=18080 DISABLE_RATE_LIMIT=1` and frontend `VITE_BACKEND_TARGET=http://127.0.0.1:18080 npx vite --host 127.0.0.1 --port 13000`.

Task 3 validation passed:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:13000'
npx playwright test tests/e2e/demo-readiness.spec.ts
npx playwright test tests/e2e/realtime-live-room.spec.ts tests/e2e/order-system.spec.ts
```

Task 4 result: no product blocker fix was required. The E2E was corrected to follow the actual SPA navigation path from merchant product list to monitor and from ended live room to buyer orders, avoiding full-page reloads that intentionally require refresh-token hydration. Price assertions now accept the rendered `¥` currency symbol.

## Task 4: Fix Demo Blockers Only

**Files:**
- Modify only files implicated by the failing E2E checkpoint.
- Add or update the nearest focused test.

- [ ] **Step 1: Classify the first blocker**

Before editing, write one line in this plan:

```markdown
Task 4 blocker: `<page/file>` failed because `<observable behavior>`.
```

Allowed blocker categories:

- Missing route entry in a page already meant to expose the workflow.
- Loading, empty, or error state that makes valid demo data look broken.
- Button enabled/disabled state that blocks the documented path.
- Text or status mismatch that hides the result from the presenter.
- Stale room/order state after route navigation.

Not allowed in this task:

- New analytics features.
- New business states.
- New backend contracts unless OpenSpec is updated first.
- Visual redesign unrelated to the demo path.

- [ ] **Step 2: Write or update a focused failing test**

For a merchant monitor blocker, use:

```powershell
cd frontend
npm test -- src/pages/merchant/AuctionMonitor.test.tsx
```

For a dashboard blocker, use:

```powershell
cd frontend
npm test -- src/pages/merchant/Dashboard.test.tsx
```

For a live-room blocker, use:

```powershell
cd frontend
npm test -- src/pages/app/LiveAuctionRoom.test.tsx src/store/liveRoomStore.test.ts
```

For an order blocker, use the nearest order page test. If no order page test exists, create one beside the page and run:

```powershell
cd frontend
npm test -- src/pages/app/OrderDetail.test.tsx
```

Expected: focused test fails for the observed blocker.

- [ ] **Step 3: Implement the smallest fix**

Make the smallest code change in the implicated page/store/API file. Do not touch unrelated styling or data contracts.

- [ ] **Step 4: Verify focused test and demo E2E**

Run the focused frontend test from Step 2, then:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
npx playwright test tests/e2e/demo-readiness.spec.ts --project=chromium
```

Expected: the focused test passes; the E2E either passes or moves to the next real blocker. Repeat Task 4 for each blocker.

- [ ] **Step 5: Commit each verified blocker fix**

Run:

```powershell
git diff --check
git add <changed-files>
git commit -m "fix(demo): <specific blocker summary>"
git push
```

Use a specific summary, for example:

```text
fix(demo): expose monitor entry for seeded auctions
fix(demo): show paid order state after payment
```

## Task 5: Presenter Runbook

**Files:**
- Create: `docs/demo-readiness.md`
- Modify: `README.md` to link to the runbook if appropriate.

- [ ] **Step 1: Create the runbook**

Create `docs/demo-readiness.md` with these sections:

```markdown
# Demo Readiness Runbook

## Purpose

Run a repeatable local demonstration of the Douyin live auction MVP.

## Required Services

- MySQL: `127.0.0.1:3307`
- Redis: `127.0.0.1:16380`
- Backend: `http://127.0.0.1:8080`
- Frontend: `http://127.0.0.1:3000`

## Start Services

```powershell
docker compose up -d mysql redis
cd backend
$env:REDIS_ADDR='127.0.0.1:16380'
go run ./cmd/server
```

In another terminal:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

## Prepare Demo Data

```powershell
cd D:\pythoncode\douyin-live
$env:DEMO_API_BASE_URL='http://127.0.0.1:8080'
npm run demo:seed
```

## Demo Accounts

- Merchant: `demo_merchant` / `test123`
- Buyer A: `demo_buyer_a` / `test123`
- Buyer B: `demo_buyer_b` / `test123`

## Presenter Path

1. Merchant opens `/merchant/dashboard`.
2. Merchant opens product management and enters the active auction monitor.
3. Buyer A opens `/app/auctions` and enters the seeded auction room.
4. Buyer A bids the next amount.
5. Buyer B opens the same auction room and bids higher.
6. Buyer A sees the private outbid notice.
7. Merchant monitor shows the updated price/ranking/feed.
8. Buyer A bids the ceiling amount and sees the terminal state.
9. Buyer A opens `/app/orders`, confirms the order, and clicks simulated payment.

## Automated Check

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
npm run test:e2e:demo
```

## Troubleshooting

- Backend health: open `http://127.0.0.1:8080/healthz`.
- Frontend unavailable: confirm Vite is running on port `3000`.
- WebSocket stale: refresh the auction room after checking backend logs.
- Register rate limits during repeated E2E: run backend with `DISABLE_RATE_LIMIT=1` on an alternate test port.
- Old demo data: rerun `npm run demo:seed`; it creates a new auction title for each run.
```

- [ ] **Step 2: Link from README**

Add a short line to `README.md`:

```markdown
## Demo

For local presentation steps, see [docs/demo-readiness.md](docs/demo-readiness.md).
```

- [ ] **Step 3: Verify docs**

Run:

```powershell
rg -n "demo-readiness|demo:seed|test:e2e:demo|demo_merchant" README.md docs/demo-readiness.md package.json
git diff --check
```

Expected: all runbook commands and accounts are findable; diff check exits `0`.

- [ ] **Step 4: Commit runbook**

Run:

```powershell
git add README.md docs/demo-readiness.md
git commit -m "docs(demo): add readiness runbook"
git push
```

Expected:

```text
[codex/demo-readiness <sha>] docs(demo): add readiness runbook
```

Task 5 result: completed. `docs/demo-readiness.md` documents required services, startup commands, demo seed command, demo accounts, presenter path, automated E2E command, and troubleshooting. `README.md` links to the runbook. Verification passed with `rg -n "demo-readiness|demo:seed|test:e2e:demo|demo_merchant" README.md docs/demo-readiness.md package.json` and `git diff --check`.

## Task 6: Final Verification, Memory, Archive

**Files:**
- Modify: `openspec/changes/demo-readiness/tasks.md`
- Modify: `docs/superpowers/plans/2026-05-31-demo-readiness.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-05-31.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`
- Archive by command: `openspec/changes/demo-readiness/`
- Modify by command: `openspec/specs/demo-readiness/spec.md`

- [ ] **Step 1: Run final verification**

Run:

```powershell
openspec validate demo-readiness --strict
openspec validate --specs --strict
cd backend
$env:GOPROXY='https://goproxy.cn,direct'
go test ./...
cd ..
cd frontend
npm run test
npm run build
cd ..
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
npm run test:e2e:demo
git diff --check
```

Expected:

- OpenSpec commands exit `0`.
- Go tests exit `0`.
- Frontend tests exit `0`.
- Frontend build exits `0`.
- Demo E2E exits `0`.
- Diff check exits `0`.

- [ ] **Step 2: Update OpenSpec tasks and memory**

Update `openspec/changes/demo-readiness/tasks.md` checkboxes to `[x]` only for completed tasks.

Append to `projects/proj-1779447357476-ryiijf/memory/2026-05-31.md`:

```markdown
## demo-readiness

- Branch: `codex/demo-readiness`.
- Added repeatable local demo seed support through existing HTTP APIs.
- Added demo-readiness Playwright journey covering merchant monitor, buyer bidding, private outbid, settlement, and order payment.
- Added presenter runbook at `docs/demo-readiness.md`.
- Verification passed:
  - `openspec validate demo-readiness --strict`
  - `openspec validate --specs --strict`
  - `cd backend && go test ./...`
  - `cd frontend && npm run test`
  - `cd frontend && npm run build`
  - `npm run test:e2e:demo`
  - `git diff --check`
- Next step: merge or PR after user acceptance.
```

Append to `projects/proj-1779447357476-ryiijf/memory/long-term.md`:

```markdown
## Demo Readiness

- Local demo runbook: `docs/demo-readiness.md`.
- Seed command: `DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed`.
- E2E command: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:demo`.
- Demo accounts: `demo_merchant`, `demo_buyer_a`, `demo_buyer_b`; password `test123`.
```

- [ ] **Step 3: Commit final docs before archive**

Run:

```powershell
git add openspec/changes/demo-readiness/tasks.md docs/superpowers/plans/2026-05-31-demo-readiness.md projects/proj-1779447357476-ryiijf/memory/2026-05-31.md projects/proj-1779447357476-ryiijf/memory/long-term.md
git commit -m "docs(demo): record readiness verification"
git push
```

Expected:

```text
[codex/demo-readiness <sha>] docs(demo): record readiness verification
```

- [ ] **Step 4: Archive accepted OpenSpec change**

Only after user acceptance, run:

```powershell
openspec archive demo-readiness --yes
openspec validate --specs --strict
git diff --check
git add openspec/changes/demo-readiness openspec/changes/archive openspec/specs
git commit -m "docs(openspec): archive demo readiness"
git push
```

Expected:

```text
Change 'demo-readiness' archived ...
Totals: ... passed, 0 failed
```

## Plan Self-Review

- Spec coverage: Task 2 covers repeatable local demo setup; Task 3 covers E2E readiness; Task 5 covers presenter runbook; Task 4 covers demo blocker polish; Task 1 covers dependency cleanup.
- Marker scan: no unresolved marker strings or open-ended deferred instructions are present.
- Scope check: no real payment, real livestream, new auction semantics, or large analytics work is included.
- Type consistency: script names, test names, environment variables, and file paths match throughout the plan.
