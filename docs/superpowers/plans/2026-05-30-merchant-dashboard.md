# Merchant Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the merchant operations dashboard from OpenSpec through backend, frontend, verification, memory, commit, and push.

**Architecture:** Add a read-only dashboard module following existing Go DTO/repository/service/handler patterns, then add a React merchant page using existing API/client/page conventions. Keep order and auction semantics unchanged.

**Tech Stack:** Go 1.24, Gin, MySQL, Redis, React 19, TypeScript, Vite, Vitest, OpenSpec.

---

### Task 1: Backend Failing Integration Tests

**Files:**
- Create: `backend/tests/integration/merchant_dashboard_test.go`
- Modify: `backend/tests/integration/auction_engine_test.go`

- [x] **Step 1: Add dashboard routes to the integration server helper**

In `setupAuctionServerWithEventBus`, instantiate dashboard repo/service/handler and add:

```go
merchant := r.Group("/api/v1/merchant")
merchant.Use(middleware.JWTAuth(cfg))
{
	merchant.GET("/dashboard", middleware.RoleGuard("merchant"), dashboardH.Get)
}
```

- [x] **Step 2: Write the failing dashboard aggregate test**

Create a test named `TestMerchantDashboardReturnsScopedOperationalSummary`. It should register two merchants and one user, create:

- one active auction for merchant A
- one paid order for merchant A
- one pending order for merchant A
- one paid order for merchant B

Then request `GET /api/v1/merchant/dashboard` as merchant A and assert:

- response status `200`
- paid summary counts only merchant A paid orders
- product status counts include zero buckets
- order status counts include paid and pending buckets
- active auctions include only merchant A
- recent orders exclude merchant B

- [x] **Step 3: Write the failing role rejection test**

Create `TestMerchantDashboardRejectsUserRole` and assert a user token receives `403`.

- [x] **Step 4: Verify RED**

Run:

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'
$env:DB_DSN='root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&loc=UTC&charset=utf8mb4'
go test ./tests/integration -run TestMerchantDashboard -count=1
```

Expected: FAIL because dashboard types, handler, and route do not exist yet.

Result: failed as expected before dashboard implementation because the route dependencies did not exist.

### Task 2: Backend Dashboard Implementation

**Files:**
- Create: `backend/internal/dto/dashboard.go`
- Create: `backend/internal/repository/merchant_dashboard_repo.go`
- Create: `backend/internal/service/merchant_dashboard_service.go`
- Create: `backend/internal/handler/merchant_dashboard_handler.go`
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/tests/integration/auction_engine_test.go`

- [x] **Step 1: Add DTOs**

Define response types for status counts, transaction summary, active auctions, recent orders, and dashboard response. Use JSON names from the OpenSpec.

- [x] **Step 2: Add repository**

Implement read-only methods:

- `ProductStatusCounts`
- `OrderStatusCounts`
- `TransactionSummary`
- `ActiveAuctions`
- `RecentOrders`

Use `merchant_id = ?` in every query.

- [x] **Step 3: Add service**

Normalize missing product and order statuses to zero and map repository rows into DTOs.

- [x] **Step 4: Add handler and route**

Expose `GET /api/v1/merchant/dashboard` for merchant role only.

- [x] **Step 5: Verify GREEN**

Run:

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'
$env:DB_DSN='root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&loc=UTC&charset=utf8mb4'
go test ./tests/integration -run TestMerchantDashboard -count=1
```

Expected: PASS.

Result: passed with `REDIS_ADDR=127.0.0.1:16380` and `DB_DSN=root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&loc=UTC&charset=utf8mb4`.

### Task 3: Frontend Failing Tests

**Files:**
- Create: `frontend/src/pages/merchant/Dashboard.test.tsx`
- Modify: `frontend/src/pages/navigationAffordance.test.ts`

- [x] **Step 1: Write dashboard render test**

Mock `getMerchantDashboard` and render `<Dashboard />`. Assert it shows:

- heading `运营看板`
- completed amount
- completed order count
- average completed price
- product status count
- order status count
- active auction product
- recent order product
- links to `/merchant/products` and `/merchant/orders`

- [x] **Step 2: Write dashboard error test**

Mock API rejection and assert `看板加载失败` appears.

- [x] **Step 3: Extend navigation affordance test**

Include `merchant/Dashboard.tsx` in the shared back button source check.

- [x] **Step 4: Verify RED**

Run:

```powershell
npm run test -- Dashboard
```

Expected: FAIL because the page and API helper do not exist.

Result: failed as expected before adding the dashboard page and API helper.

### Task 4: Frontend Dashboard Implementation

**Files:**
- Create: `frontend/src/types/dashboard.ts`
- Create: `frontend/src/api/dashboard.ts`
- Create: `frontend/src/pages/merchant/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/merchant/ProductList.tsx`
- Modify: `frontend/src/pages/merchant/OrderList.tsx`
- Modify: `frontend/src/pages/Profile.tsx`

- [x] **Step 1: Add dashboard types and API**

Add TypeScript types matching the backend JSON and `getMerchantDashboard()` using the existing Axios envelope pattern.

- [x] **Step 2: Add dashboard page**

Implement loading, error, empty-safe render, metrics, status sections, active auctions, recent orders, and links to product/order management.

- [x] **Step 3: Add route**

Add `/merchant/dashboard` with merchant role protection in `App.tsx`.

- [x] **Step 4: Add entry links**

Add visible dashboard links from merchant product list, merchant order list, and merchant profile.

- [x] **Step 5: Verify GREEN**

Run:

```powershell
npm run test -- Dashboard navigationAffordance
```

Expected: PASS.

Result: passed. Full `npm run test`, `npm run build`, and a browser smoke test also passed.

### Task 5: Final Verification And Closeout

**Files:**
- Modify: `openspec/changes/merchant-dashboard/tasks.md`
- Modify: `docs/superpowers/plans/2026-05-30-merchant-dashboard.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-05-30.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: OpenSpec validation**

Run:

```powershell
openspec validate merchant-dashboard --strict --no-interactive
openspec validate --specs --strict --no-interactive
```

Result: both commands passed.

- [x] **Step 2: Backend verification**

Run:

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'
$env:DB_DSN='root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&loc=UTC&charset=utf8mb4'
go test ./...
```

Result: passed with `REDIS_ADDR=127.0.0.1:16380` and isolated local DB `auction_db_merchant_dashboard`. The default `auction_db` was being touched by an existing local backend process, so the verification used isolated test data as required by `WORKTREE_PROMPT.md`.

- [x] **Step 3: Frontend verification**

Run:

```powershell
npm run test
npm run build
```

Result: both commands passed.

- [x] **Step 4: Diff verification**

Run:

```powershell
git diff --check
```

Result: passed with line-ending warnings only.

- [x] **Step 5: Update docs and memory**

Mark completed tasks with actual command results and record the local DB timezone note.

Result: OpenSpec tasks, this plan, and memory were updated with actual verification results and the local DB isolation/timezone note.

- [x] **Step 6: Commit and push**

Commit:

```powershell
git add backend frontend docs openspec projects
git commit -m "feat(merchant): add operations dashboard"
git push
```

Result: completed for the verified slice.

## Self-Review

- Spec coverage: all OpenSpec requirements map to backend API, frontend page, navigation, and verification tasks.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: backend and frontend response names use `product_status_counts`, `order_status_counts`, `transaction_summary`, `active_auctions`, and `recent_orders`.
