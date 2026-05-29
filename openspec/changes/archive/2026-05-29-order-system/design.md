# Design: order-system

## Technical Approach

Add a focused order module that consumes `pending_confirm` orders created by `AuctionService`. Keep the existing Go/Gin layering:

- `handler.OrderHandler` owns HTTP binding and role-aware responses.
- `service.OrderService` owns state transitions, authorization, timeout processing, and refund rules.
- `repository.OrderRepo` owns SQL queries and transactional row updates.

The existing `orders` table already has the required statuses and timestamps, so this change should avoid schema churn.

## Order State Machine

Supported transitions:

- `pending_confirm -> pending_payment` by the winning buyer confirming the order.
- `pending_payment -> paid` by the winning buyer running simulated payment.
- `pending_confirm -> cancelled` by winning buyer cancellation.
- `pending_confirm -> cancelled` by confirmation timeout.

Rejected transitions:

- Confirming any order not in `pending_confirm`.
- Paying any order not in `pending_payment`.
- Cancelling any order not in `pending_confirm`.
- Any buyer action by a user other than `buyer_id`.
- Any merchant mutation action.

## Wallet And Refund Model

Existing behavior from `auction-engine`:

1. Winning bid freezes user balance during bidding.
2. Settlement marks the winning bid `won`.
3. Settlement deducts frozen balance and creates `orders.status = 'pending_confirm'`.

Order-system behavior:

- Confirm does not change wallet fields.
- Simulated payment does not change wallet fields.
- Cancel or timeout of a `pending_confirm` order refunds by adding `orders.amount` back to `users.balance`.
- Refund and order cancellation happen in the same DB transaction while the order row is locked.
- The service must re-check status inside the transaction so repeated cancel/timeout attempts cannot refund twice.

This preserves current auction-engine tests while satisfying the confirmation-timeout refund requirement.

## API Surface

Use one role-aware order resource:

- `GET /api/v1/orders`
  - role `user`: returns orders where `buyer_id = current_user`.
  - role `merchant`: returns orders where `merchant_id = current_user`.
  - Optional filters: `status`, `page`, `size`.
- `GET /api/v1/orders/:id`
  - returns detail if the caller is the buyer or merchant on the order.
- `POST /api/v1/orders/:id/confirm`
  - role `user` only; requires `buyer_id = current_user` and `status = pending_confirm`.
- `POST /api/v1/orders/:id/pay`
  - role `user` only; requires `buyer_id = current_user` and `status = pending_payment`.
- `POST /api/v1/orders/:id/cancel`
  - role `user` only; requires `buyer_id = current_user` and `status = pending_confirm`.
  - Body may contain `reason`; service stores `buyer_cancelled` when blank.

Response shapes should include:

- order id, auction id, product id, merchant id, buyer id
- product title and first image when available
- buyer display name for merchant views
- amount, status, cancel reason
- created, updated, confirmed, paid, cancelled timestamps
- confirm deadline for pending-confirm orders
- available actions for the current caller

## Timeout Worker

Add an order confirmation timeout worker in `cmd/server/main.go`, similar to the auction settlement worker.

- Interval: one minute in production.
- Deadline rule: `orders.created_at <= now - 30 minutes`.
- Selection: `status = 'pending_confirm'`.
- Processing: lock candidate rows, cancel with `cancel_reason = 'confirm_timeout'`, set `cancelled_at`, refund buyer balance.
- Tests may call `OrderService.ExpirePendingConfirmOrders(ctx, now)` directly after aging `created_at`.

## Frontend Architecture

Add frontend routes:

- `/app/orders`: buyer order list.
- `/app/orders/:id`: buyer order detail with confirm/cancel/pay actions according to status.
- `/merchant/orders`: merchant order list.
- `/merchant/orders/:id`: merchant order detail.

Add entry points:

- User auction lobby header links to orders.
- User live room terminal state links to order list when the auction ends sold.
- Merchant product list header links to orders.

Use existing API client, auth store, route guards, and visual patterns. Keep the UI operational and concise; do not build dashboard charts in this change.

## Testing Strategy

Backend integration tests:

- Buyer confirms a `pending_confirm` order and wallet is unchanged.
- Buyer pays a `pending_payment` order and wallet is unchanged.
- Buyer cancels a `pending_confirm` order and receives one refund.
- Timeout cancels aged `pending_confirm` orders and refunds once.
- Repeated cancel/timeout attempts do not double refund.
- Unauthorized buyer and non-owner merchant cannot access another user's order.
- Merchant list/detail only returns own merchant orders.

Frontend tests:

- Buyer order list renders `pending_confirm`, `pending_payment`, `paid`, and `cancelled` states.
- Buyer detail shows only valid actions for each state.
- Confirm, cancel, and pay actions call the expected endpoints and refresh visible state.
- Merchant order list/detail render buyer, product, amount, and status.

E2E:

- Merchant creates/publishes/activates an auction.
- Buyer wins and order appears as `pending_confirm`.
- Buyer confirms and pays.
- UI shows final `paid` state.

## Risks And Mitigations

- Existing settlement deduction could cause double charge if payment deducts again. Mitigation: payment is status-only and covered by wallet assertions.
- Timeout and manual cancel can race. Mitigation: lock order rows and update only from `pending_confirm`.
- Order cancellation might be confused with auction cancellation. Mitigation: do not mutate `auctions` or `products`; expose cancellation on order status and reason.
- Frontend routes can sprawl. Mitigation: build only list/detail/action views required for the demo.
