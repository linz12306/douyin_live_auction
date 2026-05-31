# Design: merchant-dashboard

## Technical Approach

Add a read-only merchant dashboard module that follows the existing backend layering. The handler owns HTTP and role context, the service owns response normalization and business definitions, and the repository owns aggregate SQL.

The dashboard route is merchant-only:

- `GET /api/v1/merchant/dashboard`
- JWT required.
- `RoleGuard("merchant")` required.
- Every query uses the authenticated merchant id.

No schema changes are needed.

## Response Model

The response contains five sections:

- `product_status_counts`: stable status buckets for `draft`, `pending`, `active`, `ended_sold`, `ended_no_bid`, and `cancelled`.
- `order_status_counts`: stable status buckets for `pending_confirm`, `pending_payment`, `paid`, and `cancelled`.
- `transaction_summary`: total paid amount, paid order count, and average paid price from `orders.status = 'paid'`.
- `active_auctions`: up to five active auctions ordered by nearest `ended_at`, including bid count.
- `recent_orders`: up to five newest merchant orders ordered by `created_at DESC, id DESC`.

## Backend Files

- Create `backend/internal/dto/dashboard.go`.
- Create `backend/internal/repository/merchant_dashboard_repo.go`.
- Create `backend/internal/service/merchant_dashboard_service.go`.
- Create `backend/internal/handler/merchant_dashboard_handler.go`.
- Modify `backend/cmd/server/main.go` to wire the repo, service, handler, and route.
- Add focused integration coverage in `backend/tests/integration/merchant_dashboard_test.go`.

## SQL Strategy

Use independent read queries:

- Product counts: `products WHERE merchant_id = ? GROUP BY status`.
- Order counts: `orders WHERE merchant_id = ? GROUP BY status`.
- Transaction summary: `orders WHERE merchant_id = ? AND status = 'paid'`.
- Active auctions: `auctions JOIN products LEFT JOIN bids WHERE auctions.merchant_id = ? AND auctions.status = 'active' GROUP BY auction`.
- Recent orders: `orders JOIN products JOIN users buyer LEFT JOIN first product image WHERE orders.merchant_id = ?`.

The service fills missing status buckets with zero counts so the frontend does not need to infer absent states.

## Frontend Files

- Create `frontend/src/types/dashboard.ts`.
- Create `frontend/src/api/dashboard.ts`.
- Create `frontend/src/pages/merchant/Dashboard.tsx`.
- Modify `frontend/src/App.tsx` to add `/merchant/dashboard`.
- Modify:
  - `frontend/src/pages/merchant/ProductList.tsx`
  - `frontend/src/pages/merchant/OrderList.tsx`
  - `frontend/src/pages/Profile.tsx`

## Frontend UX

Use the existing merchant visual style and operational layout. The first viewport should be the actual dashboard, not a landing page. Include:

- Compact metric tiles for completed amount, completed count, average paid price, active auctions, and recent order count.
- Product and order status sections.
- Active auction list with price, bid count, and end time.
- Recent order list with buyer, product, amount, and status.
- Direct links to product management and order management.

## Error Handling

- Backend returns `403` through existing role guard for non-merchant callers.
- Backend returns `500` only for unexpected query failures.
- Frontend shows loading, error, and empty states without mutating any data.

## Testing Strategy

Backend integration tests:

- Merchant dashboard aggregates only the current merchant's data.
- Completed metrics count only `paid` orders.
- Active auctions include only the current merchant's active auctions.
- Recent orders are scoped and ordered.
- User role cannot access the route.

Frontend tests:

- Dashboard loads and renders metrics, status counts, active auctions, and recent orders.
- Dashboard shows an error state when the API fails.
- Product management, order management, and profile expose links to `/merchant/dashboard`.

## Known Local Verification Note

This worktree's local MySQL session returns `NOW()` in UTC while Go's default local time is Asia/Shanghai. Existing tests that directly write `NOW()` to DATETIME fields can report active auctions as already ended. If final verification uses the current local database, set `DB_DSN` with `loc=UTC` or update the test fixtures to write application-generated timestamps.
