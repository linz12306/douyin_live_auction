## ADDED Requirements

### Requirement: Bid placement
The system SHALL allow an authenticated user account to place a bid on an active auction when the bid amount satisfies the auction's increment rule and the user has enough available balance.

#### Scenario: Valid fixed-increment bid
- **GIVEN** an active auction with current price 100 and fixed increment 10
- **AND** a user has at least 110 available balance
- **WHEN** the user bids 110
- **THEN** the bid is accepted
- **AND** the user's balance is frozen for 110
- **AND** the auction current price becomes 110
- **AND** the user becomes the highest bidder

#### Scenario: Bid below required increment is rejected
- **GIVEN** an active auction with current price 100 and fixed increment 10
- **WHEN** a user bids 105
- **THEN** the bid is rejected
- **AND** wallet and auction state remain unchanged

### Requirement: Outbid wallet handling
The system SHALL unfreeze the previous highest bidder's active bid amount when a higher valid bid replaces it.

#### Scenario: Previous bidder is outbid
- **GIVEN** user A has an active frozen bid of 110
- **WHEN** user B places a valid bid of 120
- **THEN** user A's 110 is unfrozen
- **AND** user A's bid status becomes `outbid`
- **AND** user B's 120 is frozen
- **AND** user B's bid status is `active`

### Requirement: Auction rankings
The system SHALL provide rankings for an auction ordered by bid amount descending and bid time ascending for ties.

#### Scenario: Rankings include bidder display data
- **GIVEN** an auction has multiple bids
- **WHEN** rankings are requested
- **THEN** bidders are returned in rank order
- **AND** each row includes user id, display name, avatar URL, bid amount, bid status, and bid time

### Requirement: Soft Close extension
The system SHALL extend an active auction when a valid bid arrives within the configured auto-extend window and the maximum extension count has not been reached.

#### Scenario: Bid extends auction near end
- **GIVEN** an active auction has 10 seconds remaining
- **AND** `auto_extend_seconds` is 15 and `max_extend_count` is 5
- **AND** `current_extend_count` is 0
- **WHEN** a valid bid is placed
- **THEN** the auction end time is extended according to the Soft Close rule
- **AND** `current_extend_count` increases by 1

### Requirement: Ceiling-price settlement
The system SHALL settle an active auction as sold when a valid bid reaches or exceeds the configured ceiling price.

#### Scenario: Bid reaches ceiling price
- **GIVEN** an active auction has ceiling price 500
- **WHEN** a user places a valid bid of 500
- **THEN** the auction status becomes `ended_sold`
- **AND** an order is created with status `pending_confirm`
- **AND** the winning bid status becomes `won`

### Requirement: Time-based settlement
The system SHALL settle active auctions when their end time is reached.

#### Scenario: Pending auction is activated
- **GIVEN** a pending auction owned by a merchant
- **WHEN** the merchant activates the auction
- **THEN** the auction status becomes `active`
- **AND** the product status becomes `active`
- **AND** `started_at` and `ended_at` are set from the activation time and duration

#### Scenario: Auction ends with a bid
- **GIVEN** an active auction has an active highest bid
- **WHEN** the auction end time is reached
- **THEN** the auction status becomes `ended_sold`
- **AND** an order is created for the highest bidder

#### Scenario: Auction ends without bids
- **GIVEN** an active auction has no active bid
- **WHEN** the auction end time is reached
- **THEN** the auction status becomes `ended_no_bid`
- **AND** no order is created

### Requirement: Merchant cancellation
The system SHALL allow the owning merchant to cancel pending auctions and allow active auction cancellation only when cancellation restrictions are satisfied.

#### Scenario: Pending auction cancellation
- **GIVEN** a pending auction owned by a merchant
- **WHEN** the merchant cancels with a reason
- **THEN** the auction status becomes `cancelled`
- **AND** the product status becomes `cancelled`
- **AND** an audit log records the reason

#### Scenario: Active cancellation blocked after recent bid
- **GIVEN** an active auction had a bid less than 30 seconds ago
- **WHEN** the merchant attempts cancellation
- **THEN** cancellation is rejected
- **AND** auction and wallet state remain unchanged

### Requirement: Audit logging
The system SHALL record audit logs for bid placement, wallet freeze, wallet unfreeze, settlement, cancellation, and Soft Close extension.

#### Scenario: Bid audit log is created
- **GIVEN** a user places a valid bid
- **WHEN** the bid transaction commits
- **THEN** an audit log exists with the auction id, user id, action, and JSON detail
