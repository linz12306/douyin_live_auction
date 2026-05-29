# order-system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the post-win order workflow: buyer confirmation, simulated payment, confirmation timeout/cancellation refund, user order pages, and merchant order inspection.

**Architecture:** Backend adds an order module in the existing Gin handler -> service -> repository shape, reusing the current `orders` table and `users.balance` wallet fields. Frontend adds small role-scoped order list/detail experiences under `/app/orders` and `/merchant/orders` using the existing client, auth store, and route guards.

**Tech Stack:** Go/Gin/MySQL, existing JWT middleware and integration test helpers, React + TypeScript + Vite, Playwright for E2E.

---

## Current Context

- Branch: `codex/order-system`
- OpenSpec change: `openspec/changes/order-system/`
- Existing order schema: `backend/migrations/007_create_orders.sql`
- Existing settlement handoff:
  - `AuctionService.PlaceBid` creates `pending_confirm` order when a ceiling bid settles.
  - `AuctionService.SettleExpired` creates `pending_confirm` order when an active auction expires with a bid.
  - Both paths already call `DeductFrozenBalance`, so simulated payment must not deduct again.
- Existing authenticated API group lives in `backend/cmd/server/main.go`.
- Existing frontend protected routes live in `frontend/src/App.tsx`.

## File Structure

Backend create:

- `backend/internal/dto/order.go`: order query, list item, detail, cancel request, action response DTOs.
- `backend/internal/repository/order_repo.go`: order reads, row locking, transition updates, refund and timeout selection.
- `backend/internal/service/order_service.go`: role scoping, buyer transitions, timeout processing.
- `backend/internal/handler/order_handler.go`: HTTP endpoints and error mapping.
- `backend/tests/integration/order_system_test.go`: integration tests for API behavior and wallet invariants.

Backend modify:

- `backend/cmd/server/main.go`: wire order module routes and timeout worker.
- `openspec/changes/order-system/tasks.md`: sync task status after verified slices.

Frontend create:

- `frontend/src/types/order.ts`: order status, list item, detail, available action types.
- `frontend/src/api/order.ts`: list/detail/confirm/pay/cancel helpers.
- `frontend/src/pages/app/OrderList.tsx`: user order list.
- `frontend/src/pages/app/OrderDetail.tsx`: user order detail/actions.
- `frontend/src/pages/merchant/OrderList.tsx`: merchant order list.
- `frontend/src/pages/merchant/OrderDetail.tsx`: merchant order detail.
- `tests/e2e/order-system.spec.ts`: browser happy path.

Frontend modify:

- `frontend/src/App.tsx`: add user and merchant order routes.
- `frontend/src/pages/app/AuctionLobby.tsx`: add user order entry.
- `frontend/src/pages/app/LiveAuctionRoom.tsx`: add terminal sold link to orders.
- `frontend/src/pages/merchant/ProductList.tsx`: add merchant order entry.

## Task 1: Baseline Verification And Plan Sync

**Files:**
- Create: `docs/superpowers/plans/2026-05-29-order-system.md`
- Modify: `openspec/changes/order-system/tasks.md`

- [x] **Step 1: Create the execution plan**

Write this plan from the locked OpenSpec change.

- [ ] **Step 2: Mark OpenSpec task 2 complete**

Update `openspec/changes/order-system/tasks.md` task 2 to checked and record that this plan was created.

- [ ] **Step 3: Validate OpenSpec**

Run:

```bash
npx -y @fission-ai/openspec@latest validate order-system --strict --no-interactive
```

Expected: `Change 'order-system' is valid`.

- [ ] **Step 4: Commit plan slice**

Run:

```bash
git add docs/superpowers/plans/2026-05-29-order-system.md openspec/changes/order-system/tasks.md
git commit -m "docs(order): add implementation plan"
```

## Task 2: Backend DTOs, Repository, And Service

**Files:**
- Create: `backend/internal/dto/order.go`
- Create: `backend/internal/repository/order_repo.go`
- Create: `backend/internal/service/order_service.go`
- Create: `backend/tests/integration/order_system_test.go`

- [ ] **Step 1: Write integration tests for buyer transitions**

Create `backend/tests/integration/order_system_test.go` with tests:

```go
func TestOrderBuyerCanConfirmAndPayWithoutWalletMutation(t *testing.T)
func TestOrderBuyerCanCancelPendingConfirmAndRefundOnce(t *testing.T)
func TestOrderTimeoutCancelsAndRefundsOnce(t *testing.T)
func TestOrderRejectsWrongBuyerAndWrongStatusTransitions(t *testing.T)
```

Use existing helpers from `auction_engine_test.go` to register merchant/user accounts, publish and activate an auction, place a ceiling bid or settle an expired auction, then query the created order.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend
/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration -run 'TestOrder'
```

Expected: FAIL because order service/repo/handler do not exist yet.

- [ ] **Step 3: Add order DTOs**

Create `backend/internal/dto/order.go` with these public types:

```go
package dto

import "time"

type OrderListQuery struct {
	Status string `form:"status"`
	Page   int    `form:"page"`
	Size   int    `form:"size"`
}

type OrderCancelRequest struct {
	Reason string `json:"reason"`
}

type OrderAvailableActions struct {
	CanConfirm bool `json:"can_confirm"`
	CanPay     bool `json:"can_pay"`
	CanCancel  bool `json:"can_cancel"`
}

type OrderListItem struct {
	ID              int64                  `json:"id"`
	AuctionID       int64                  `json:"auction_id"`
	ProductID       int64                  `json:"product_id"`
	MerchantID      int64                  `json:"merchant_id"`
	BuyerID         int64                  `json:"buyer_id"`
	ProductTitle    string                 `json:"product_title"`
	ProductImageURL *string                `json:"product_image_url,omitempty"`
	BuyerName       string                 `json:"buyer_name,omitempty"`
	BuyerAvatarURL  string                 `json:"buyer_avatar_url,omitempty"`
	Amount          float64                `json:"amount"`
	Status          string                 `json:"status"`
	CancelReason    string                 `json:"cancel_reason,omitempty"`
	ConfirmDeadline *time.Time             `json:"confirm_deadline,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	ConfirmedAt     *time.Time             `json:"confirmed_at,omitempty"`
	PaidAt          *time.Time             `json:"paid_at,omitempty"`
	CancelledAt     *time.Time             `json:"cancelled_at,omitempty"`
	Actions         OrderAvailableActions  `json:"actions"`
}

type OrderDetailResponse struct {
	OrderListItem
	ProductDescription string `json:"product_description"`
}

type OrderListResponse struct {
	Items []OrderListItem `json:"items"`
	Total int             `json:"total"`
	Page  int             `json:"page"`
	Size  int             `json:"size"`
}
```

- [ ] **Step 4: Add repository**

Create `backend/internal/repository/order_repo.go` with `OrderRow`, `OrderRepo`, and methods:

```go
func NewOrderRepo(db *sql.DB) *OrderRepo
func (r *OrderRepo) WithTx(ctx context.Context, fn func(*sql.Tx) error) error
func (r *OrderRepo) ListForUser(ctx context.Context, buyerID int64, status string, page, size int) ([]OrderRow, int, error)
func (r *OrderRepo) ListForMerchant(ctx context.Context, merchantID int64, status string, page, size int) ([]OrderRow, int, error)
func (r *OrderRepo) FindByID(ctx context.Context, orderID int64) (*OrderRow, error)
func (r *OrderRepo) FindByIDForUpdate(ctx context.Context, tx *sql.Tx, orderID int64) (*OrderRow, error)
func (r *OrderRepo) Confirm(ctx context.Context, tx *sql.Tx, orderID int64, now time.Time) error
func (r *OrderRepo) Pay(ctx context.Context, tx *sql.Tx, orderID int64, now time.Time) error
func (r *OrderRepo) Cancel(ctx context.Context, tx *sql.Tx, orderID int64, reason string, now time.Time) error
func (r *OrderRepo) RefundBuyer(ctx context.Context, tx *sql.Tx, buyerID int64, amount float64) error
func (r *OrderRepo) ListExpiredPendingConfirmIDs(ctx context.Context, tx *sql.Tx, deadline time.Time, limit int) ([]int64, error)
```

Use joins against `products`, `users`, and first `product_images` to populate list/detail rows. Use `SELECT ... FOR UPDATE` for mutating paths.

- [ ] **Step 5: Add service**

Create `backend/internal/service/order_service.go` with errors and methods:

```go
var (
	ErrOrderNotFound = errors.New("订单不存在")
	ErrOrderForbidden = errors.New("无权操作此订单")
	ErrOrderInvalidStatus = errors.New("当前订单状态不允许此操作")
)

const OrderConfirmTimeout = 30 * time.Minute

func NewOrderService(repo *repository.OrderRepo) *OrderService
func (s *OrderService) ListOrders(ctx context.Context, userID int64, role string, query *dto.OrderListQuery) (*dto.OrderListResponse, error)
func (s *OrderService) GetOrder(ctx context.Context, userID int64, role string, orderID int64) (*dto.OrderDetailResponse, error)
func (s *OrderService) ConfirmOrder(ctx context.Context, userID int64, orderID int64) (*dto.OrderDetailResponse, error)
func (s *OrderService) PayOrder(ctx context.Context, userID int64, orderID int64) (*dto.OrderDetailResponse, error)
func (s *OrderService) CancelOrder(ctx context.Context, userID int64, orderID int64, reason string) (*dto.OrderDetailResponse, error)
func (s *OrderService) ExpirePendingConfirmOrders(ctx context.Context, now time.Time) (int, error)
```

Rules:

- user role lists by `buyer_id`; merchant role lists by `merchant_id`.
- buyer mutations require `buyer_id == userID`.
- confirm requires `pending_confirm` and sets `confirmed_at`.
- pay requires `pending_payment` and sets `paid_at`.
- cancel/timeout require `pending_confirm`, update order to `cancelled`, and refund `amount` once.
- confirm and pay never update `users.balance` or `users.frozen_amount`.

- [ ] **Step 6: Run focused backend tests**

Run:

```bash
cd backend
/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration -run 'TestOrder'
```

Expected: PASS.

- [ ] **Step 7: Commit backend core slice**

Run:

```bash
git add backend/internal/dto/order.go backend/internal/repository/order_repo.go backend/internal/service/order_service.go backend/tests/integration/order_system_test.go
git commit -m "feat(order): add order state service"
```

## Task 3: Backend Handler, Routes, And Timeout Worker

**Files:**
- Create: `backend/internal/handler/order_handler.go`
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/tests/integration/order_system_test.go`

- [ ] **Step 1: Write API integration tests**

Add tests:

```go
func TestOrderAPIBuyerListsConfirmsPaysOrder(t *testing.T)
func TestOrderAPIMerchantListsAndViewsOwnOrders(t *testing.T)
func TestOrderAPIScopesOrdersByRole(t *testing.T)
```

Assert REST endpoints return role-scoped data and reject unauthorized access.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend
/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration -run 'TestOrderAPI'
```

Expected: FAIL because routes are not wired.

- [ ] **Step 3: Add handler**

Create `backend/internal/handler/order_handler.go` with methods:

```go
func NewOrderHandler(svc *service.OrderService) *OrderHandler
func (h *OrderHandler) List(c *gin.Context)
func (h *OrderHandler) Get(c *gin.Context)
func (h *OrderHandler) Confirm(c *gin.Context)
func (h *OrderHandler) Pay(c *gin.Context)
func (h *OrderHandler) Cancel(c *gin.Context)
```

Map service errors to:

- `ErrOrderNotFound` -> 404
- `ErrOrderForbidden` -> 403
- `ErrOrderInvalidStatus` -> 400
- default -> 500

- [ ] **Step 4: Wire routes and worker**

Modify `backend/cmd/server/main.go`:

- instantiate `orderRepo := repository.NewOrderRepo(db)`
- instantiate `orderSvc := service.NewOrderService(orderRepo)`
- instantiate `orderH := handler.NewOrderHandler(orderSvc)`
- add authenticated `/api/v1/orders` group with list/detail/confirm/pay/cancel
- add `startOrderTimeoutWorker(orderSvc)` after auction worker

Worker function:

```go
func startOrderTimeoutWorker(orderSvc *service.OrderService) {
	ticker := time.NewTicker(time.Minute)
	go func() {
		for range ticker.C {
			if _, err := orderSvc.ExpirePendingConfirmOrders(context.Background(), time.Now()); err != nil {
				log.Printf("order timeout worker failed: %v", err)
			}
		}
	}()
}
```

- [ ] **Step 5: Verify backend routes**

Run:

```bash
cd backend
/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration -run 'TestOrder|TestAuctionEngineEndToEndFlow'
/Users/vivix/.local/go/bin/go test -count=1 ./...
```

Expected: PASS.

- [ ] **Step 6: Commit route slice**

Run:

```bash
git add backend/internal/handler/order_handler.go backend/cmd/server/main.go backend/tests/integration/order_system_test.go
git commit -m "feat(order): expose order APIs"
```

## Task 4: User Frontend Orders

**Files:**
- Create: `frontend/src/types/order.ts`
- Create: `frontend/src/api/order.ts`
- Create: `frontend/src/pages/app/OrderList.tsx`
- Create: `frontend/src/pages/app/OrderDetail.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/app/AuctionLobby.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`

- [ ] **Step 1: Write frontend tests**

Add tests near the pages:

```tsx
// frontend/src/pages/app/OrderList.test.tsx
it('renders buyer order states and links to detail', async () => {})

// frontend/src/pages/app/OrderDetail.test.tsx
it('shows confirm and cancel for pending_confirm orders', async () => {})
it('shows pay for pending_payment orders', async () => {})
it('hides mutation actions for paid and cancelled orders', async () => {})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend
npm test -- src/pages/app/OrderList.test.tsx src/pages/app/OrderDetail.test.tsx vite.config.test.ts
```

Expected: FAIL because pages/API do not exist.

- [ ] **Step 3: Add frontend types and API**

Create `frontend/src/types/order.ts` with:

```ts
export type OrderStatus = 'pending_confirm' | 'pending_payment' | 'paid' | 'cancelled';

export interface OrderActions {
  can_confirm: boolean;
  can_pay: boolean;
  can_cancel: boolean;
}

export interface OrderListItem {
  id: number;
  auction_id: number;
  product_id: number;
  merchant_id: number;
  buyer_id: number;
  product_title: string;
  product_image_url?: string;
  buyer_name?: string;
  buyer_avatar_url?: string;
  amount: number;
  status: OrderStatus;
  cancel_reason?: string;
  confirm_deadline?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  paid_at?: string;
  cancelled_at?: string;
  actions: OrderActions;
}

export interface OrderDetail extends OrderListItem {
  product_description: string;
}
```

Create `frontend/src/api/order.ts` with `listOrders`, `getOrder`, `confirmOrder`, `payOrder`, `cancelOrder`.

- [ ] **Step 4: Add user pages and routes**

Build `/app/orders` and `/app/orders/:id` with existing visual conventions. Show status badges, price, product image, confirm deadline, and role-appropriate action buttons.

- [ ] **Step 5: Verify user frontend**

Run:

```bash
cd frontend
npm test -- src/pages/app/OrderList.test.tsx src/pages/app/OrderDetail.test.tsx vite.config.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit user frontend slice**

Run:

```bash
git add frontend/src/types/order.ts frontend/src/api/order.ts frontend/src/pages/app/OrderList.tsx frontend/src/pages/app/OrderDetail.tsx frontend/src/pages/app/OrderList.test.tsx frontend/src/pages/app/OrderDetail.test.tsx frontend/src/App.tsx frontend/src/pages/app/AuctionLobby.tsx frontend/src/pages/app/LiveAuctionRoom.tsx
git commit -m "feat(order): add user order pages"
```

## Task 5: Merchant Frontend Orders

**Files:**
- Create: `frontend/src/pages/merchant/OrderList.tsx`
- Create: `frontend/src/pages/merchant/OrderDetail.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/merchant/ProductList.tsx`

- [ ] **Step 1: Write merchant frontend tests**

Add tests:

```tsx
// frontend/src/pages/merchant/OrderList.test.tsx
it('renders merchant orders with buyer and amount', async () => {})

// frontend/src/pages/merchant/OrderDetail.test.tsx
it('renders merchant order detail without buyer-only actions', async () => {})
```

- [ ] **Step 2: Add merchant pages and routes**

Create `/merchant/orders` and `/merchant/orders/:id`. Reuse order API, show buyer display name/avatar, product title/image, amount, status, cancel reason, and timestamps. Do not show confirm/pay/cancel buttons.

- [ ] **Step 3: Verify merchant frontend**

Run:

```bash
cd frontend
npm test -- src/pages/merchant/OrderList.test.tsx src/pages/merchant/OrderDetail.test.tsx vite.config.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit merchant frontend slice**

Run:

```bash
git add frontend/src/pages/merchant/OrderList.tsx frontend/src/pages/merchant/OrderDetail.tsx frontend/src/pages/merchant/OrderList.test.tsx frontend/src/pages/merchant/OrderDetail.test.tsx frontend/src/App.tsx frontend/src/pages/merchant/ProductList.tsx
git commit -m "feat(order): add merchant order views"
```

## Task 6: End-to-End Workflow

**Files:**
- Create: `tests/e2e/order-system.spec.ts`
- Modify: `playwright.config.ts` only if current setup requires a timeout or route adjustment.

- [ ] **Step 1: Write Playwright E2E**

Create a test that:

1. registers merchant and buyer through API
2. creates product with image URL
3. publishes auction with ceiling price
4. activates auction
5. buyer enters live room or uses API to bid ceiling amount
6. buyer opens `/app/orders`
7. buyer opens the order detail
8. buyer confirms
9. buyer pays
10. final detail shows paid status

- [ ] **Step 2: Run E2E**

Run with the same style used by realtime tests:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npx playwright test tests/e2e/order-system.spec.ts
```

Expected: PASS against a running current backend/frontend pair.

- [ ] **Step 3: Commit E2E slice**

Run:

```bash
git add tests/e2e/order-system.spec.ts playwright.config.ts
git commit -m "test(order): cover paid order workflow"
```

Skip `playwright.config.ts` if unchanged.

## Task 7: Final Verification, Docs, And Memory

**Files:**
- Modify: `openspec/changes/order-system/tasks.md`
- Modify: `docs/superpowers/plans/2026-05-29-order-system.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-05-29.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [ ] **Step 1: Run final verification**

Run:

```bash
npx -y @fission-ai/openspec@latest validate order-system --strict --no-interactive
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
cd backend && /Users/vivix/.local/go/bin/go test ./...
cd ../frontend && npm run build
cd ..
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Sync task checkboxes**

Update OpenSpec and this plan so only truly verified work is checked.

- [ ] **Step 3: Update memory**

Record:

- implemented APIs and routes
- wallet decision: payment is status-only, pre-confirm cancellation refunds once
- verification commands and results
- push status

- [ ] **Step 4: Commit final docs slice**

Run:

```bash
git add openspec/changes/order-system/tasks.md docs/superpowers/plans/2026-05-29-order-system.md projects/proj-1779447357476-ryiijf/memory/2026-05-29.md projects/proj-1779447357476-ryiijf/memory/long-term.md
git commit -m "docs(order): record implementation status"
```

## Self-Review

- Spec coverage: every OpenSpec requirement maps to backend state tests, role-scoped API tests, frontend user/merchant views, or E2E.
- Placeholder scan: no `TBD` or unbounded "add appropriate" steps remain.
- Type consistency: `pending_confirm`, `pending_payment`, `paid`, and `cancelled` match the existing `orders.status` enum.
- Risk control: wallet mutation rules are explicitly tested so simulated payment cannot double charge.
