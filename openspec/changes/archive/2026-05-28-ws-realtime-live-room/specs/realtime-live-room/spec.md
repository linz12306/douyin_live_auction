## ADDED Requirements

### Requirement: User auction lobby
The system SHALL provide a user-facing auction lobby at `/app/auctions` where authenticated user accounts can find joinable auction products.

#### Scenario: User opens auction lobby
- **GIVEN** an authenticated user account
- **WHEN** the user opens `/app/auctions`
- **THEN** the lobby displays auction products with status, image when available, current price, and a room entry action

### Requirement: User live auction room
The system SHALL provide a mobile-first live auction room at `/app/auctions/:id` for realtime auction participation.

#### Scenario: User opens live room
- **GIVEN** an authenticated user account
- **AND** an auction exists
- **WHEN** the user opens `/app/auctions/:id`
- **THEN** the room shows simulated live ambience, current price, countdown, bid action, and rankings in the first live-room experience

### Requirement: WebSocket room connection
The system SHALL allow authenticated users to connect to an auction WebSocket room and receive a full snapshot on join or reconnect.

#### Scenario: Initial room snapshot
- **GIVEN** an authenticated user account
- **AND** an auction exists
- **WHEN** the user connects to `/ws/auctions/:id`
- **THEN** the server accepts the connection
- **AND** sends a `snapshot` message containing current auction state, rankings, version, and server time

#### Scenario: Unauthenticated WebSocket rejected
- **GIVEN** no valid user authentication token
- **WHEN** a client connects to `/ws/auctions/:id`
- **THEN** the server rejects the connection
- **AND** no room membership is created

### Requirement: Realtime message contract
The system SHALL send realtime auction messages with a stable envelope containing `type`, `auction_id`, `version`, `server_time`, and `payload`.

#### Scenario: Message includes ordering metadata
- **GIVEN** an auction room client is connected
- **WHEN** the server sends a realtime message
- **THEN** the message includes the auction id
- **AND** a monotonic auction state version
- **AND** server time
- **AND** a typed payload

### Requirement: Bid updates broadcast through WebSocket
The system SHALL broadcast accepted bid results to all clients in the auction room through WebSocket messages.

#### Scenario: Accepted bid updates room
- **GIVEN** user A and user B are connected to the same auction room
- **WHEN** user A places a valid bid through REST
- **THEN** the server broadcasts a `price_update` message to the auction room
- **AND** connected clients can update current price, highest bidder, rankings, and version from that message

### Requirement: Private outbid notification
The system SHALL send a private `outbid` message only to the user whose previous active bid was replaced.

#### Scenario: Previous bidder receives outbid
- **GIVEN** user A is the current highest bidder and is connected to the auction room
- **AND** user B is connected to the same auction room
- **WHEN** user B places a valid higher bid
- **THEN** user A receives an `outbid` message
- **AND** user B does not receive user A's private `outbid` message

### Requirement: Soft Close realtime extension
The system SHALL notify connected room clients when a valid bid triggers Soft Close extension.

#### Scenario: Extension message resets countdown
- **GIVEN** an active auction has remaining time inside the auto-extend window
- **AND** a room client is connected
- **WHEN** a valid bid extends the auction
- **THEN** the server sends an `extended` message
- **AND** the payload includes the updated end time and current extension count

### Requirement: Auction terminal realtime update
The system SHALL notify connected room clients when an auction reaches a terminal state.

#### Scenario: Auction end disables bidding
- **GIVEN** a room client is connected to an active auction
- **WHEN** the auction becomes `ended_sold`, `ended_no_bid`, or `cancelled`
- **THEN** the server sends an `auction_end` message
- **AND** the client disables bid actions for that auction

### Requirement: WebSocket is realtime truth source
The frontend SHALL treat WebSocket messages as the source of truth for realtime room state after the room connection is established.

#### Scenario: REST bid success waits for WebSocket state
- **GIVEN** a user is connected to a live auction room
- **WHEN** the user submits a bid through REST
- **AND** the REST request succeeds
- **THEN** the frontend does not update current price or rankings from the REST response alone
- **AND** waits for a WebSocket message to update realtime room state

#### Scenario: Stale message ignored
- **GIVEN** the frontend has applied auction version 10
- **WHEN** a WebSocket message for the same auction arrives with version 9
- **THEN** the frontend ignores the stale message
- **AND** the visible auction state does not roll back
