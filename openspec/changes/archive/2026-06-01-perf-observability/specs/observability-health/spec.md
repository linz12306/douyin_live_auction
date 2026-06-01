## MODIFIED Requirements

### Requirement: Component health response
The health endpoint SHALL return top-level status, check timestamp, and component entries for DB, Redis, and auction engine.

#### Scenario: All components healthy
- **GIVEN** MySQL ping succeeds
- **AND** Redis ping succeeds
- **AND** the auction engine runtime is constructed
- **WHEN** a client requests `GET /healthz`
- **THEN** the response status code is 200
- **AND** the body top-level status is `ok`
- **AND** the body includes `checked_at`
- **AND** `components.db.status` is `ok`
- **AND** `components.redis.status` is `ok`
- **AND** `components.auction_engine.status` is `ok`

#### Scenario: Component stats included
- **GIVEN** the realtime runtime has active room, connected client, or dropped event counters
- **WHEN** a client requests `GET /healthz`
- **THEN** `components.auction_engine` includes active room count
- **AND** `components.auction_engine` includes connected client count
- **AND** `components.auction_engine` includes dropped event count

#### Scenario: Auction performance metrics included
- **GIVEN** bid requests have been accepted or rejected by the auction engine
- **AND** WebSocket clients may be connected to auction rooms
- **WHEN** a client requests `GET /healthz`
- **THEN** `components.auction_engine.bid_requests_total` reports total observed bid requests
- **AND** `components.auction_engine.bid_success_total` reports successful bid requests
- **AND** `components.auction_engine.bid_failure_total` reports failed bid requests
- **AND** `components.auction_engine.bid_success_rate` reports the success ratio from `0` to `1`
- **AND** `components.auction_engine.bid_avg_latency_ms` reports average bid latency in milliseconds
- **AND** `components.auction_engine.bid_lock_busy_total` reports bid lock contention outcomes
- **AND** `components.auction_engine.ws_connections_current` reports current WebSocket connections

## ADDED Requirements

### Requirement: Local performance evidence
The system SHALL provide local tooling and documentation to demonstrate auction bid throughput and realtime connection observability without external monitoring infrastructure.

#### Scenario: Load script help is available
- **GIVEN** the repository is checked out locally
- **WHEN** a developer runs `node scripts/load-auction.mjs --help`
- **THEN** the script prints usage information
- **AND** the script does not require a running backend for help output

#### Scenario: Local load script exercises a live auction
- **GIVEN** the backend is running
- **AND** a live auction id and user tokens are available
- **WHEN** a developer runs the load script with bid concurrency options
- **THEN** the script sends concurrent bid requests to `POST /api/v1/auctions/:id/bid`
- **AND** the script prints request count, success count, failure count, average latency, and lock/contention-oriented guidance
- **AND** the script can optionally open WebSocket room connections when a WebSocket runtime is available

#### Scenario: Performance report explains demo evidence
- **GIVEN** a judge or presenter opens `docs/performance-report.md`
- **WHEN** they read the report template
- **THEN** it explains how to run local load checks
- **AND** it defines each `/healthz` auction-engine metric
- **AND** it provides a concise narrative for the local single-process scope
