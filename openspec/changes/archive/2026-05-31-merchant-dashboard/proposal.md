# Proposal: merchant-dashboard

## Why

Merchants currently have product and order management pages, but no first-stop operations dashboard. After the auction engine, realtime room, order workflow, and health checks are in place, merchants still need a scoped overview of their own products, orders, completed transaction value, active auctions, and recent order activity.

## What Changes

- Add `GET /api/v1/merchant/dashboard` for authenticated merchant accounts.
- Return product status counts for the current merchant.
- Return order status counts for the current merchant.
- Return completed transaction metrics from `paid` orders: total amount, order count, and average price.
- Return active auction summaries for the current merchant.
- Return recent orders for the current merchant.
- Add frontend route `/merchant/dashboard`.
- Add dashboard entry points from product management, order management, and profile pages.
- Add focused backend and frontend tests.

## Important Compatibility Decisions

- Completed transaction metrics SHALL count only `orders.status = 'paid'`.
- Pending confirmation, pending payment, and cancelled orders remain visible in order status stats and recent orders, but do not count toward completed amount, completed count, or average completed price.
- Active auction summary is a REST snapshot. Realtime monitoring, push updates, charts, and alerting remain out of scope for `merchant-dashboard`.

## Impact

- Backend:
  - New dashboard DTO/repository/service/handler.
  - New merchant dashboard route under `/api/v1/merchant/dashboard`.
  - Integration tests for merchant scoping, aggregates, active auction summary, recent orders, and role rejection.
- Frontend:
  - New dashboard API/types/page.
  - New protected route `/merchant/dashboard`.
  - New navigation entries from merchant pages and profile.
  - Component tests for rendering and entry points.
- Schema:
  - No migration planned. Reuse `products`, `auctions`, `bids`, and `orders`.

## Out Of Scope

- Merchant realtime monitoring page.
- Charting libraries, trend charts, bid distribution charts, or user activity analytics.
- Any change to auction settlement, bidding, order state transitions, wallet accounting, or payment semantics.
- Admin views across multiple merchants.
