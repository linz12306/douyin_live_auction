# merchant-dashboard Specification

## Purpose
TBD - created by archiving change merchant-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Merchant dashboard API
The system SHALL provide an authenticated merchant dashboard API scoped to the current merchant.

#### Scenario: Merchant views scoped dashboard
- **GIVEN** an authenticated merchant account
- **WHEN** the merchant requests `GET /api/v1/merchant/dashboard`
- **THEN** the response includes only products, auctions, bids, and orders owned by the current merchant
- **AND** it includes product status counts, order status counts, completed transaction metrics, active auction summaries, and recent orders

#### Scenario: User cannot access merchant dashboard
- **GIVEN** an authenticated user account
- **WHEN** the user requests `GET /api/v1/merchant/dashboard`
- **THEN** the request is rejected

### Requirement: Product and order status statistics
The dashboard SHALL return stable status buckets for merchant products and orders.

#### Scenario: Missing product statuses return zero
- **GIVEN** a merchant has products in only some product statuses
- **WHEN** the merchant opens the dashboard
- **THEN** product status counts include `draft`, `pending`, `active`, `ended_sold`, `ended_no_bid`, and `cancelled`
- **AND** statuses without products have count `0`

#### Scenario: Missing order statuses return zero
- **GIVEN** a merchant has orders in only some order statuses
- **WHEN** the merchant opens the dashboard
- **THEN** order status counts include `pending_confirm`, `pending_payment`, `paid`, and `cancelled`
- **AND** statuses without orders have count `0`

### Requirement: Completed transaction metrics
The dashboard SHALL calculate completed transaction amount, completed order count, and average completed price from paid orders only.

#### Scenario: Paid orders define completed metrics
- **GIVEN** a merchant has paid, pending, and cancelled orders
- **WHEN** the merchant opens the dashboard
- **THEN** total completed amount sums only orders with status `paid`
- **AND** completed order count includes only orders with status `paid`
- **AND** average completed price is the paid amount divided by paid order count

#### Scenario: Merchant has no paid orders
- **GIVEN** a merchant has no paid orders
- **WHEN** the merchant opens the dashboard
- **THEN** total completed amount is `0`
- **AND** completed order count is `0`
- **AND** average completed price is `0`

### Requirement: Active auction summary
The dashboard SHALL return a concise REST snapshot of active auctions owned by the current merchant.

#### Scenario: Active auctions are scoped and ordered
- **GIVEN** a merchant owns multiple auctions
- **WHEN** the merchant opens the dashboard
- **THEN** active auction summaries include only auctions with status `active`
- **AND** each summary includes auction id, product id, product title, current price, highest bidder id, bid count, started time, and ended time
- **AND** summaries are ordered by nearest end time first

### Requirement: Recent merchant orders
The dashboard SHALL return recent orders owned by the current merchant.

#### Scenario: Recent orders include buyer and product context
- **GIVEN** a merchant has orders
- **WHEN** the merchant opens the dashboard
- **THEN** recent orders include order id, auction id, product id, product title, optional product image, buyer id, buyer display name, buyer avatar URL, amount, status, and timestamps
- **AND** orders are ordered by newest first
- **AND** orders from other merchants are excluded

### Requirement: Merchant dashboard frontend
The frontend SHALL provide a merchant dashboard page and visible merchant navigation entries.

#### Scenario: Merchant opens dashboard page
- **GIVEN** an authenticated merchant account
- **WHEN** the merchant opens `/merchant/dashboard`
- **THEN** the page loads the merchant dashboard API
- **AND** it displays completed metrics, product status counts, order status counts, active auctions, and recent orders
- **AND** it provides navigation to product management and order management

#### Scenario: Dashboard entry points are discoverable
- **GIVEN** an authenticated merchant account
- **WHEN** the merchant uses product management, order management, or profile
- **THEN** there is a visible navigation path to `/merchant/dashboard`

