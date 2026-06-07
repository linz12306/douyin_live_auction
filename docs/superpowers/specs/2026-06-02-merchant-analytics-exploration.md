# Merchant Analytics Exploration

## Goal

Extend the merchant PC dashboard with charted analytics for transaction trend, bid distribution, and user activity, scoped to the current merchant.

This slice should make `/merchant/dashboard` feel like a balanced operations dashboard for repeated merchant use while preserving existing auction, order, wallet, payment, WebSocket, and cancellation semantics.

## Non-Goals

- Do not change buyer H5 live-room behavior.
- Do not change auction engine, wallet, order, payment, settlement, cancellation, or WebSocket semantics.
- Do not add production BI, cross-merchant analytics, export workflows, or performance observability dashboards.
- Do not infer analytics from unrelated frontend pages or user-visible realtime state.
- Do not expose buyer-only order actions on merchant pages.

## Workflow Choice

This is full workflow work rather than fast lane. It expands a public merchant dashboard API response and adds user-facing dashboard acceptance criteria. Per `AGENTS.md`, it requires Superpowers exploration, OpenSpec lock, a Superpowers execution plan, implementation, verification, and memory.

## Preflight Findings

- Current branch: `codex/merchant-analytics-dashboard`.
- Existing old local branch/worktree `codex/merchant-analytics` is occupied at an older commit, so this work uses a new branch to avoid overwriting it.
- `requirements-v3.md` requires merchant data dashboard views for transaction trend, bid distribution, and user activity statistics, scoped to the current merchant.
- `frontend-experience-roadmap` defines `merchant-analytics` as the owner of merchant dashboard charts, trend, bid distribution, user activity presentation, and chart loading/empty/error states.
- `openspec/specs/merchant-dashboard/spec.md` currently requires product/order status counts, paid transaction summary, active auction summaries, recent orders, and frontend dashboard navigation.
- `frontend/src/pages/merchant/Dashboard.tsx` currently renders metrics, status buckets, active auctions, and recent orders, but no analytics charts.
- `frontend/src/types/dashboard.ts` and `frontend/src/api/dashboard.ts` currently model only the existing dashboard response.
- `backend/internal/dto/dashboard.go`, `backend/internal/repository/merchant_dashboard_repo.go`, and `backend/internal/service/merchant_dashboard_service.go` already provide a read-only dashboard module.
- Existing `GET /api/v1/merchant/dashboard` data is insufficient for real analytics charts. Transaction trend, bid distribution, and user activity need additional merchant-scoped aggregate fields from orders and bids.
- Existing `bids` and `orders` schema supports these read-only aggregates:
  - paid orders by paid date for transaction trend,
  - bid amount buckets for distribution,
  - daily bid count and distinct bidder count for user activity.

## User Brainstorm Checkpoint

The user confirmed the next package should be `merchant-analytics` after the H5 auction atmosphere slice.

Confirmed split:

- Implement merchant analytics as a PC operations dashboard enhancement.
- If existing dashboard API data is insufficient, lock a read-only API contract before implementation.
- Preserve existing summary metrics, status buckets, active auction entries, and recent orders.
- Keep analytics scoped to the current merchant only.
- Do not mix this work with buyer H5 atmosphere, demo materials, or performance observability.

## Users

- Merchant operator: wants to understand sales performance, bid behavior, and bidder engagement from the dashboard.
- Presenter or reviewer: wants to see a credible merchant-side analytics surface after demonstrating live bidding and payment.
- Future backend/frontend workers: need stable field names and empty-state expectations for dashboard analytics.

## Scenarios

### Merchant Opens Analytics Dashboard

1. Merchant opens `/merchant/dashboard`.
2. Dashboard loads `GET /api/v1/merchant/dashboard`.
3. Existing summary metrics and operational lists remain visible.
4. New chart areas show transaction trend, bid distribution, and user activity when data exists.
5. Charts are readable on desktop and degrade cleanly on narrower screens.

### Zero Data

1. Merchant has no paid orders or bids.
2. Dashboard still shows status buckets and lists.
3. Chart areas show clear zero-data states instead of broken axes or misleading values.

### API Failure

1. Dashboard API fails.
2. Existing page-level error remains visible.
3. No stale analytics state is shown.

### Merchant Scoping

1. Multiple merchants have orders and bids.
2. Merchant A loads the dashboard.
3. Analytics include only Merchant A's products, auctions, bids, and orders.
4. Other merchant paid orders and bids do not affect chart values.

## Recommended API Contract

Extend the existing `MerchantDashboardResponse` with:

```json
{
  "analytics": {
    "transaction_trend": [
      { "date": "2026-06-02", "paid_amount": 1200, "paid_order_count": 3 }
    ],
    "bid_distribution": [
      { "bucket": "0-99", "min_amount": 0, "max_amount": 99, "bid_count": 8 }
    ],
    "user_activity": [
      { "date": "2026-06-02", "active_user_count": 5, "bid_count": 12 }
    ]
  }
}
```

Rules:

- `transaction_trend` is the last 7 calendar days, zero-filled, based on paid orders only.
- `bid_distribution` uses stable amount buckets and counts bids on the current merchant's auctions only.
- `user_activity` is the last 7 calendar days, zero-filled, based on bids on the current merchant's auctions only.
- Existing response fields remain backward-compatible.

## Acceptance Criteria

- Backend dashboard response includes `analytics.transaction_trend`, `analytics.bid_distribution`, and `analytics.user_activity`.
- Analytics are scoped to the current merchant.
- Empty or missing analytics data renders zero-data chart states in the frontend.
- Merchant dashboard shows charted transaction trend, bid distribution, and user activity without replacing existing summary, status, active auction, or recent order sections.
- Frontend tests cover populated analytics, zero-data analytics, and API failure.
- Backend integration tests cover merchant scoping for analytics.
- OpenSpec strict validation, backend tests, frontend tests, frontend build, and whitespace checks pass.

## Technical Direction

- Extend the existing `GET /api/v1/merchant/dashboard` response instead of adding a new route.
- Add read-only repository aggregate methods for analytics.
- Keep the dashboard service responsible for zero-filling expected day ranges and status/bucket normalization.
- Implement chart-like UI with CSS bars/lines rather than adding a charting dependency for this MVP slice.
- Preserve the dashboard's operational PC feel: dense, scan-friendly, no entertainment-style live-room visuals.

## Risks

- Date/time grouping can drift if DB timezone and app timezone differ. Mitigation: use backend date labels consistently and test aggregate shape rather than local browser formatting.
- Analytics can imply precision beyond available data. Mitigation: show simple labels and unavailable/zero states.
- Backend aggregate work can accidentally include other merchants. Mitigation: every query must filter by merchant ownership, and integration tests must include another merchant's data.
- Adding response fields may break TypeScript if optional/empty handling is not explicit. Mitigation: default analytics arrays to empty on frontend.
