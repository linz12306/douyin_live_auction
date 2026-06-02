# Proposal: merchant-analytics

## Why

`requirements-v3.md` requires merchant dashboard analytics for transaction trend, bid distribution, and user activity. The current merchant dashboard shows operational metrics, status buckets, active auctions, and recent orders, but it does not expose chart data or charted analytics views.

The existing dashboard response is not sufficient for accurate analytics. This change extends the read-only merchant dashboard API with scoped aggregate analytics and renders those aggregates on the merchant PC dashboard.

## What Changes

- Extend `GET /api/v1/merchant/dashboard` with an `analytics` object:
  - `transaction_trend`
  - `bid_distribution`
  - `user_activity`
- Keep analytics scoped to the authenticated merchant.
- Add backend aggregate queries and service normalization for zero-filled chart data.
- Add frontend dashboard chart sections with populated, zero-data, loading, and error-safe behavior.
- Preserve existing dashboard summary metrics, product/order status buckets, active auction list, recent orders, and navigation.

## Compatibility Decisions

- This is a backward-compatible response extension to the existing merchant dashboard endpoint.
- No auction, wallet, order, payment, settlement, cancellation, database schema, or WebSocket semantic changes are introduced.
- No buyer H5 live-room surfaces are changed.
- No new chart dependency is required; the frontend uses lightweight CSS chart components.
- Analytics are read-only and scoped to the current merchant.

## Impact

- Backend:
  - Extend dashboard DTOs, repository, and service.
  - Extend merchant dashboard integration tests.
- Frontend:
  - Extend dashboard types.
  - Extend `/merchant/dashboard` UI and tests.
- Documentation:
  - Add Superpowers exploration and plan.
  - Add OpenSpec change files.
- Testing:
  - Backend integration tests for analytics scoping.
  - Frontend tests for chart rendering and zero-data states.
  - Build, OpenSpec validation, and whitespace checks.

## Out Of Scope

- Real-time merchant analytics over WebSocket.
- Cross-merchant analytics.
- Production BI, exports, filters, custom date ranges, or drill-down reports.
- Performance observability metrics.
- Buyer H5 atmosphere or demo material changes.
