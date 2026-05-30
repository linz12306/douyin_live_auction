# Merchant Dashboard Exploration

## Goal

Build a merchant operations dashboard for the current merchant account. The dashboard gives a compact, scoped overview of product inventory state, order state, completed transaction value, active auctions, and recent orders.

## Non-Goals

- Do not build the merchant realtime monitoring page. That belongs to `merchant-auction-monitor`.
- Do not change auction, bid, settlement, order, wallet, or payment semantics.
- Do not add charting libraries or long-range analytics in this slice.
- Do not expose cross-merchant data.

## Users

- Merchant operators who need a quick PC后台 landing page before drilling into product and order management.

## Scenarios

- A merchant opens `/merchant/dashboard` and sees only their own product counts grouped by product status.
- A merchant sees only their own order counts grouped by order status.
- A merchant sees completed transaction metrics based on `paid` orders: total amount, paid order count, and average paid price.
- A merchant sees a concise list of active auctions ordered by nearest end time.
- A merchant sees recent orders with buyer, product, amount, status, and timestamps.
- A user account cannot access the merchant dashboard API or page.
- Existing merchant product, order, and profile pages expose a visible route to the dashboard.

## Acceptance Criteria

- Backend adds `GET /api/v1/merchant/dashboard`.
- The route requires authentication and `merchant` role.
- The response is scoped by `merchant_id = current_user_id`.
- Product status stats cover `draft`, `pending`, `active`, `ended_sold`, `ended_no_bid`, and `cancelled`, returning zero counts where absent.
- Order status stats cover `pending_confirm`, `pending_payment`, `paid`, and `cancelled`, returning zero counts where absent.
- Completed transaction metrics count only `paid` orders.
- Active auction summary includes auction id, product id, product title, current price, highest bidder id, bid count, and start/end times.
- Recent orders return the newest merchant orders, including product title, optional product image, buyer display info, amount, status, and timestamps.
- Frontend adds `/merchant/dashboard` and entry points from product management, order management, and profile.
- Existing order and auction behavior stays unchanged.

## Risks

- Revenue overstatement: counting pending or cancelled orders as completed would mislead merchants. Mitigation: define completed metrics as `orders.status = 'paid'`.
- Dashboard data leakage: aggregate queries must filter by current merchant id. Mitigation: role guard plus merchant id in every query.
- Scope creep into realtime analytics: active auction summary is a REST snapshot only. Realtime monitoring remains out of scope.
- Local test environment mismatch: this worktree's MySQL session time is UTC while the Go process uses local time by default. Existing tests that write `NOW()` into DATETIME fields can fail unless tests use a UTC DSN or application-generated timestamps.

## Technical Direction

Follow the existing Go/Gin layering:

- `dto` defines dashboard response shapes.
- `repository` owns read-only aggregate SQL.
- `service` normalizes status buckets and maps rows to DTOs.
- `handler` binds the current merchant id and returns the dashboard response.
- `cmd/server/main.go` wires `GET /api/v1/merchant/dashboard`.

Follow the existing React patterns:

- Add `frontend/src/types/dashboard.ts`.
- Add `frontend/src/api/dashboard.ts`.
- Add `frontend/src/pages/merchant/Dashboard.tsx`.
- Wire a protected merchant route in `frontend/src/App.tsx`.
- Add visible dashboard links from merchant product list, merchant order list, and profile.

## Verification Plan

- `openspec validate merchant-dashboard --strict --no-interactive`
- `openspec validate --specs --strict --no-interactive`
- Backend TDD:
  - write a failing integration test for the merchant dashboard response and role scoping
  - implement repository/service/handler/routes
  - rerun focused backend tests
- Frontend TDD:
  - write failing component/API route tests for the dashboard and entry points
  - implement API/types/page/routes/links
  - rerun focused frontend tests
- Final:
  - `cd backend && go test ./...` with `REDIS_ADDR=127.0.0.1:16380`
  - `cd frontend && npm run test`
  - `cd frontend && npm run build`
  - `git diff --check`
