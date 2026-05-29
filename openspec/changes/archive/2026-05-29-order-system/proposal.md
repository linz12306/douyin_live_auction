# Proposal: order-system

## Why

The auction engine can already settle an auction and create an `orders` row with status `pending_confirm`, but there is no order workflow after that handoff. Buyers cannot confirm a win, run simulated payment, recover funds when confirmation times out, or review order details. Merchants also cannot inspect completed auction orders.

This leaves the auction demo without a closed post-win transaction path.

## What Changes

- Add buyer order confirmation from `pending_confirm` to `pending_payment`.
- Add simulated payment from `pending_payment` to `paid`.
- Add buyer cancellation and confirmation-timeout cancellation from `pending_confirm` to `cancelled`.
- Refund the buyer exactly once when a `pending_confirm` order is cancelled before confirmation.
- Add authenticated order list and detail APIs scoped by caller role.
- Add frontend user order list/detail pages with confirm, cancel, and pay actions.
- Add frontend merchant order list/detail pages for order inspection.
- Wire the workflow to orders created by the existing auction engine.

## Important Compatibility Decision

The existing auction engine deducts the winning frozen amount when it creates the `pending_confirm` order. Therefore this change SHALL NOT deduct wallet balance again during simulated payment. If a `pending_confirm` order is cancelled or times out before buyer confirmation, this change refunds the order amount to the buyer as a compensating balance update.

## Impact

- Backend:
  - New order DTO/repository/service/handler code.
  - New routes under `/api/v1/orders`.
  - New confirmation-timeout worker.
  - Integration tests for order state transitions, role scoping, and refund idempotency.
- Frontend:
  - New order API/types.
  - New user order routes under `/app/orders`.
  - New merchant order routes under `/merchant/orders`.
  - Focused UI tests or E2E coverage for the happy path.
- Schema:
  - Reuse existing `orders` table from `007_create_orders.sql`.
  - No migration is planned unless implementation discovers a verified missing index or field.

## Out Of Scope

- Real payment provider integration.
- Logistics, shipment, address collection, or merchant fulfillment actions.
- Merchant analytics dashboards.
- Reworking auction settlement to keep funds frozen until payment.
