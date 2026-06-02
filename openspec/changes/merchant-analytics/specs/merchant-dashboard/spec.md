## ADDED Requirements

### Requirement: Merchant dashboard analytics API
The merchant dashboard API SHALL include read-only analytics aggregates scoped to the authenticated merchant.

#### Scenario: Dashboard response includes analytics
- **GIVEN** an authenticated merchant account
- **WHEN** the merchant requests `GET /api/v1/merchant/dashboard`
- **THEN** the response includes `analytics.transaction_trend`
- **AND** the response includes `analytics.bid_distribution`
- **AND** the response includes `analytics.user_activity`
- **AND** existing dashboard response fields remain present

#### Scenario: Transaction trend is scoped and zero-filled
- **GIVEN** a merchant has paid orders across the last 7 calendar days
- **WHEN** the dashboard response is generated
- **THEN** `analytics.transaction_trend` contains 7 date points
- **AND** each point includes `date`, `paid_amount`, and `paid_order_count`
- **AND** days without paid orders are returned with zero values
- **AND** paid orders from other merchants are excluded

#### Scenario: Bid distribution is scoped to merchant auctions
- **GIVEN** bids exist on auctions owned by multiple merchants
- **WHEN** the dashboard response is generated for one merchant
- **THEN** `analytics.bid_distribution` contains stable amount buckets
- **AND** each bucket includes `bucket`, `min_amount`, optional `max_amount`, and `bid_count`
- **AND** only bids on auctions owned by the current merchant are counted
- **AND** missing buckets are returned with zero counts

#### Scenario: User activity is scoped and zero-filled
- **GIVEN** bids exist across the last 7 calendar days
- **WHEN** the dashboard response is generated
- **THEN** `analytics.user_activity` contains 7 date points
- **AND** each point includes `date`, `active_user_count`, and `bid_count`
- **AND** days without bids are returned with zero values
- **AND** bids from other merchants' auctions are excluded

### Requirement: Merchant analytics dashboard frontend
The merchant dashboard frontend SHALL render transaction trend, bid distribution, and user activity analytics while preserving the existing operations dashboard.

#### Scenario: Merchant views populated analytics charts
- **GIVEN** dashboard analytics data is available
- **WHEN** the merchant opens `/merchant/dashboard`
- **THEN** the page shows a transaction trend chart
- **AND** the page shows a bid distribution chart
- **AND** the page shows a user activity chart
- **AND** existing summary metrics, status buckets, active auctions, recent orders, and navigation remain visible

#### Scenario: Merchant analytics are empty
- **GIVEN** dashboard analytics arrays are empty or all values are zero
- **WHEN** the merchant opens `/merchant/dashboard`
- **THEN** each analytics chart area shows a clear zero-data state
- **AND** existing dashboard sections remain usable

#### Scenario: Dashboard API fails
- **GIVEN** the merchant dashboard API fails
- **WHEN** the page renders the failure
- **THEN** the page-level dashboard error is visible
- **AND** stale or inferred analytics charts are not shown
