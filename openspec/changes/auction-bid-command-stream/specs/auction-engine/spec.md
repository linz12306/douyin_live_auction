## ADDED Requirements

### Requirement: Asynchronous bid command enqueue
The auction engine SHALL provide an authenticated asynchronous bid endpoint that enqueues bid commands without removing the existing synchronous bid endpoint.

#### Scenario: New async bid command is queued
- **GIVEN** an authenticated user account
- **AND** an auction id
- **WHEN** the user submits `POST /api/v1/auctions/:id/bid/async` with a valid amount payload
- **THEN** the response status is `202 Accepted`
- **AND** the response includes a command id, auction id, amount, and status `queued`
- **AND** the command is durably recorded for worker processing

#### Scenario: Synchronous bid endpoint remains available
- **GIVEN** an authenticated user account
- **WHEN** the user submits `POST /api/v1/auctions/:id/bid`
- **THEN** the request follows the existing synchronous bid behavior
- **AND** the endpoint is not replaced by the asynchronous command path

### Requirement: Bid command idempotency
The auction engine SHALL deduplicate asynchronous bid commands by user, auction, and idempotency key.

#### Scenario: Duplicate async idempotency key returns existing command
- **GIVEN** an authenticated user submitted an async bid command with `X-Idempotency-Key`
- **WHEN** the same user submits another async bid for the same auction with the same idempotency key
- **THEN** the response returns the existing command state
- **AND** no additional command is queued
- **AND** no duplicate wallet freeze, bid, or order can be created from the duplicate request

#### Scenario: Missing idempotency key creates independent commands
- **GIVEN** an authenticated user does not send `X-Idempotency-Key`
- **WHEN** the user submits multiple async bid commands for the same auction
- **THEN** each request creates a distinct command
- **AND** worker-side auction validation determines which commands are accepted or rejected

### Requirement: Bid command status query
The auction engine SHALL allow users to query their own asynchronous bid command status.

#### Scenario: User queries own command
- **GIVEN** an authenticated user owns a bid command for an auction
- **WHEN** the user requests `GET /api/v1/auctions/:id/bid-commands/:command_id`
- **THEN** the response includes command id, auction id, amount, status, failure reason when present, bid id when accepted, order id when settled, auction version when known, and timestamps

#### Scenario: User cannot query another user's command
- **GIVEN** an authenticated user does not own a bid command
- **WHEN** the user requests that command by id
- **THEN** the request is rejected or returns not found
- **AND** the other user's command details are not exposed

### Requirement: Ordered asynchronous bid processing
The auction engine SHALL process queued bid commands sequentially for the same auction and MAY process different auctions concurrently.

#### Scenario: Same auction commands process in command order
- **GIVEN** multiple queued bid commands exist for the same auction
- **WHEN** workers process commands for that auction
- **THEN** commands are applied in durable command id order
- **AND** each command observes auction state left by earlier commands for that auction

#### Scenario: Different auctions process concurrently
- **GIVEN** queued bid commands exist for auction A and auction B
- **WHEN** workers process the bid command stream
- **THEN** commands for auction A and auction B may be processed by separate workers at the same time
- **AND** each auction still preserves its own command order

### Requirement: Async worker consistency and reentry safety
The auction engine SHALL process asynchronous commands through the same bid transaction rules as synchronous bidding and SHALL tolerate duplicate worker delivery.

#### Scenario: Accepted async bid mutates state like sync bid
- **GIVEN** an active auction and a queued async command with a valid amount
- **WHEN** the worker processes the command
- **THEN** the bid is accepted through the shared bid logic
- **AND** the new bidder balance is frozen
- **AND** the previous active bidder is unfrozen and marked `outbid` when applicable
- **AND** exactly one active bid remains unless the auction settles

#### Scenario: Rejected async bid does not freeze balance
- **GIVEN** a queued async command with a low amount, closed auction, or insufficient balance
- **WHEN** the worker processes the command
- **THEN** the command status becomes `rejected`
- **AND** no bid is inserted for that rejected command
- **AND** wallet balances and frozen amounts are not mutated by that rejected command

#### Scenario: Duplicate worker delivery does not duplicate side effects
- **GIVEN** a worker processed an async command
- **WHEN** the same stream message or command is processed again after retry or restart
- **THEN** wallet freeze, wallet unfreeze, bid insertion, settlement deduction, and order creation are not repeated
- **AND** the command remains in its terminal status

#### Scenario: Ceiling settlement remains unique
- **GIVEN** an async command reaches the auction ceiling price
- **WHEN** the worker processes or reprocesses the command
- **THEN** the auction can become `ended_sold`
- **AND** exactly one order exists for the auction
- **AND** exactly one bid is marked `won`
