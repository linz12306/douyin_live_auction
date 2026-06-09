## ADDED Requirements

### Requirement: Bid command realtime status
The realtime live room SHALL provide private asynchronous bid command status messages without changing the existing committed auction event contract.

#### Scenario: Command owner receives queued and processing status
- **GIVEN** a user is connected to an auction WebSocket room
- **WHEN** the user submits an async bid command
- **THEN** the HTTP enqueue response returns `status=queued`
- **AND** the server may send private `bid_command` messages to that user for later asynchronous progress such as `processing`
- **AND** those messages include command id, auction id, amount, status, and server time

#### Scenario: Accepted command still emits price update
- **GIVEN** an async bid command is accepted by the worker
- **WHEN** the bid transaction commits
- **THEN** connected room clients receive the existing committed auction messages such as `price_update`, `outbid`, `extended`, or `auction_end` as applicable
- **AND** the command owner can receive a private `bid_command` status of `accepted`

#### Scenario: Rejected or failed command is observable
- **GIVEN** an async bid command is rejected or fails
- **WHEN** the command status is recorded
- **THEN** the command owner can receive a private `bid_command` message with status `rejected` or `failed`
- **AND** the message includes a failure reason when available

#### Scenario: Existing WebSocket truth-source behavior remains
- **GIVEN** the frontend has joined a live room
- **WHEN** a bid is accepted through sync or async processing
- **THEN** frontend auction price, rankings, countdown, and terminal state continue to update from committed WebSocket auction messages
- **AND** command status messages do not replace `price_update`, `outbid`, `extended`, or `auction_end`

### Requirement: Realtime backplane burst tolerance
The realtime live room SHALL reduce avoidable Redis Streams subscriber drops during local high-concurrency async bid bursts.

#### Scenario: Burst of queued commands does not flood room clients
- **GIVEN** many users enqueue async bid commands for one auction
- **WHEN** each HTTP request receives a queued command response
- **THEN** the server does not need to publish a separate `queued` command event to the shared `auction_events` backplane for every enqueue
- **AND** later worker-owned command outcomes remain observable through command query and private realtime messages where possible

#### Scenario: Backend subscriber buffers absorb short realtime bursts
- **GIVEN** Redis Streams delivers a burst of committed auction events to a backend subscriber
- **WHEN** the Hub is still serializing prior messages
- **THEN** the subscriber buffer absorbs the burst within the documented local load-test range
- **AND** `/healthz` dropped event counters remain suitable for detecting real realtime backpressure
