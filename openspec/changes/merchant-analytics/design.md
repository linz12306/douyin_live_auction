# Design: merchant-analytics

## Technical Approach

Extend the existing merchant dashboard module rather than creating a new analytics route. The dashboard remains a single read-only merchant operations surface:

```text
GET /api/v1/merchant/dashboard
  -> existing summary/status/list data
  -> new analytics aggregates
  -> React dashboard chart sections
```

This keeps analytics navigation simple for the MVP and avoids a second dashboard data-fetching path.

## API Shape

Add `analytics` to `MerchantDashboardResponse`:

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

### Transaction Trend

- Last 7 calendar days.
- Zero-filled when no paid order exists for a day.
- Uses paid orders only.
- Fields:
  - `date`: `YYYY-MM-DD`
  - `paid_amount`
  - `paid_order_count`

### Bid Distribution

- Stable buckets by bid amount:
  - `0-99`
  - `100-499`
  - `500-999`
  - `1000-4999`
  - `5000+`
- Counts bids on auctions owned by the current merchant.
- Fields:
  - `bucket`
  - `min_amount`
  - `max_amount` omitted for open-ended bucket
  - `bid_count`

### User Activity

- Last 7 calendar days.
- Zero-filled when no bids exist for a day.
- Uses bids on auctions owned by the current merchant.
- Fields:
  - `date`: `YYYY-MM-DD`
  - `active_user_count`: distinct bidders that day
  - `bid_count`

## Backend Implementation

Add repository rows and methods:

- `TransactionTrend(ctx, merchantID, days)`
- `BidDistribution(ctx, merchantID)`
- `UserActivity(ctx, merchantID, days)`

Every query must join or filter through merchant-owned records:

- Orders: `orders.merchant_id = ?`
- Bids: join `auctions a ON a.id = bids.auction_id` and filter `a.merchant_id = ?`

The service maps repository rows into DTOs and zero-fills the last 7 days for trend/activity. Bucket normalization ensures all distribution buckets are present, even when count is zero.

## Frontend Implementation

Extend `frontend/src/types/dashboard.ts` with analytics types and make `analytics` optional-safe at render time.

Extend `Dashboard.tsx` with an analytics section:

- Transaction trend bar/line-style chart.
- Bid distribution horizontal bars.
- User activity chart showing bid count and active user count.

The charts should:

- Use compact PC dashboard styling.
- Avoid introducing a charting dependency.
- Show zero-data copy when all values are zero or arrays are missing.
- Preserve existing loading/error behavior.
- Keep navigation and operational lists usable.

## Verification

Backend:

- Extend merchant dashboard integration test to include another merchant's paid order and bid data.
- Assert analytics include only the current merchant's data.
- Assert transaction trend and user activity arrays are zero-filled.
- Assert bid distribution buckets are present.

Frontend:

- Extend dashboard test with populated analytics assertions.
- Add zero-data analytics test.
- Keep API failure test.
- Run full frontend tests and build.

## Risks And Mitigations

- Timezone grouping risk: use backend date labels consistently and avoid browser-local regrouping.
- Query scoping risk: integration test includes other merchant data and asserts it is excluded.
- Visual clutter risk: charts remain compact and operational, placed after top summary/status sections.
- Dependency risk: use CSS chart primitives instead of adding a new chart package.
