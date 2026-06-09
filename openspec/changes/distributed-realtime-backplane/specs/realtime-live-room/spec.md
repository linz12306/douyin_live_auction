## ADDED Requirements

### Requirement: Distributed realtime backplane
The realtime live room SHALL support multi-backend deployment through a Redis Streams shared event backplane while preserving the existing WebSocket message contract.

#### Scenario: Committed event is broadcast through independent stream subscribers
- **GIVEN** two backend instances share the same MySQL and Redis
- **AND** each backend instance subscribes to the realtime Redis Stream with its own cursor
- **WHEN** backend A publishes one committed auction event to the stream
- **THEN** backend A receives the event through its stream subscriber
- **AND** backend B receives the same event through its stream subscriber
- **AND** the event is not load-balanced away from either backend

#### Scenario: Clients on different backend instances receive bid updates
- **GIVEN** two backend instances share the same MySQL and Redis
- **AND** user A is connected to auction room 1 through backend A
- **AND** user B is connected to auction room 1 through backend B
- **WHEN** user A places an accepted bid through backend A
- **THEN** backend B receives the committed auction event through the backplane
- **AND** user B receives a `price_update` message with the same auction version

#### Scenario: Private outbid crosses backend instances
- **GIVEN** user A is connected through backend A and has the current active bid
- **AND** user B is connected through backend B
- **WHEN** user B places a higher accepted bid
- **THEN** backend A receives the committed outbid event through the backplane
- **AND** user A receives a private `outbid` message
- **AND** user B does not receive user A's private `outbid` message

#### Scenario: Snapshot recovers from missed realtime event
- **GIVEN** a backend instance misses a transient backplane event
- **WHEN** a client reconnects to `/ws/auctions/:id`
- **THEN** the initial `snapshot` message reflects the database state
- **AND** the client can recover current price, rankings, status, and countdown from the snapshot
