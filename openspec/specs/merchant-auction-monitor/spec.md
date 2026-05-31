# merchant-auction-monitor Specification

## Purpose
TBD - created by archiving change merchant-auction-monitor. Update Purpose after archive.
## Requirements
### Requirement: Merchant monitor route
The system SHALL provide a merchant-facing realtime monitor at `/merchant/auctions/:id/monitor`.

#### Scenario: Merchant opens monitor
- **GIVEN** an authenticated merchant account
- **AND** an auction id exists
- **WHEN** the merchant opens `/merchant/auctions/:id/monitor`
- **THEN** the page connects to `/ws/auctions/:id`
- **AND** the page renders auction state from the WebSocket snapshot

### Requirement: Merchant monitor entry points
The frontend SHALL expose visible monitor navigation from merchant product list and product detail for products with auctions.

#### Scenario: Product list monitor entry
- **GIVEN** a merchant product list row has an auction id
- **WHEN** the merchant views `/merchant/products`
- **THEN** the row includes an entry to `/merchant/auctions/:id/monitor`

#### Scenario: Product detail monitor entry
- **GIVEN** a merchant product detail response includes an auction
- **WHEN** the merchant views `/merchant/products/:id`
- **THEN** the page includes an entry to `/merchant/auctions/:auction_id/monitor`

### Requirement: Realtime monitor state
The monitor SHALL reuse the existing auction WebSocket snapshot and realtime messages as its realtime source of truth.

#### Scenario: Snapshot renders monitor state
- **GIVEN** the monitor is connected to an auction room
- **WHEN** a `snapshot` message is applied
- **THEN** the monitor displays product summary, current price, countdown, status, extension count, and rankings

#### Scenario: Price update renders bid event
- **GIVEN** the monitor has applied a snapshot
- **WHEN** a `price_update` message arrives with rankings
- **THEN** the current price and rankings update
- **AND** the monitor shows a bid event for the latest leading bid

### Requirement: Monitor terminal state
The monitor SHALL show terminal auction status and disable mutation actions that no longer apply.

#### Scenario: Auction ends in monitor
- **GIVEN** the monitor is connected to an auction room
- **WHEN** an `auction_end` message arrives with status `ended_sold`, `ended_no_bid`, or `cancelled`
- **THEN** the monitor displays the terminal message and final price when present
- **AND** the cancellation action is not available

### Requirement: Merchant cancellation from monitor
The monitor SHALL expose the existing merchant cancellation command for pending and active auctions with clear restrictions.

#### Scenario: Merchant cancels from monitor
- **GIVEN** the monitor is showing a pending or active auction
- **AND** the merchant has entered a cancellation reason
- **WHEN** the merchant confirms cancellation
- **THEN** the frontend calls the existing merchant cancellation API for that auction
- **AND** the monitor refreshes realtime state after the command returns

#### Scenario: Cancellation restriction copy
- **GIVEN** the monitor is showing a pending or active auction
- **WHEN** the cancellation area is visible
- **THEN** it explains that pending auctions can be cancelled directly
- **AND** it explains that active auctions cannot be cancelled within 30 seconds of the latest bid
- **AND** it explains that ended auctions cannot be cancelled

### Requirement: Minimal merchant read-only data
The backend SHALL expose only the minimal read-only auction id data needed for merchant monitor navigation.

#### Scenario: Merchant product list includes auction id
- **GIVEN** a merchant owns a published product with an auction
- **WHEN** the merchant requests their product list
- **THEN** that product row includes the auction id
- **AND** no auction bidding, settlement, wallet, or order semantics are changed

