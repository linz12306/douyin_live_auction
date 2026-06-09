## ADDED Requirements

### Requirement: Bid request idempotency
The auction engine SHALL support optional idempotency for accepted bid requests.

#### Scenario: Duplicate keyed bid returns stored result
- **GIVEN** an authenticated user has placed an accepted bid with `X-Idempotency-Key`
- **WHEN** the same user repeats `POST /api/v1/auctions/:id/bid` for the same auction with the same idempotency key
- **THEN** the response returns the original accepted bid id and bid result
- **AND** no additional bid is inserted
- **AND** wallet balances and frozen amounts are not mutated again

#### Scenario: Failed keyed bid is retryable
- **GIVEN** an authenticated user submits a keyed bid that is rejected
- **WHEN** the same user retries the same idempotency key with a valid request
- **THEN** the valid request can be processed normally
- **AND** the previous failed attempt does not create an idempotency record

### Requirement: Local concurrency consistency evidence
The auction engine SHALL have local integration coverage proving durable single-instance consistency under concurrent bid and settlement activity.

#### Scenario: Concurrent bids leave one active highest bid
- **GIVEN** an active auction and multiple user accounts
- **WHEN** many bid requests are submitted concurrently for the same auction
- **THEN** at most one bid remains `active`
- **AND** the auction current price and highest bidder match the active highest bid
- **AND** rankings show the same highest bid first
- **AND** involved user balances and frozen amounts are non-negative

#### Scenario: Concurrent settlement creates one order
- **GIVEN** an auction reaches a sellable terminal condition
- **WHEN** settlement processing is invoked concurrently
- **THEN** exactly one order exists for the auction
- **AND** exactly one bid is marked `won`
- **AND** the auction status is `ended_sold`

#### Scenario: Repeated refund path refunds once
- **GIVEN** an order is `pending_confirm`
- **WHEN** buyer cancellation and timeout processing are repeated or race
- **THEN** the order can become `cancelled`
- **AND** the buyer is refunded at most once

## MODIFIED Requirements

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
