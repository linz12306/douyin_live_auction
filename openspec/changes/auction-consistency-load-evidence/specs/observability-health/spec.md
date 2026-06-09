## ADDED Requirements

### Requirement: Redis bid lock degradation metric
The health endpoint SHALL report when bid placement degrades from Redis bid locking to database row-lock serialization because Redis lock acquisition errored.

#### Scenario: Redis lock acquisition error is counted
- **GIVEN** Redis lock acquisition returns an error during bid placement
- **WHEN** the service falls back to database row-lock serialization
- **THEN** `components.auction_engine.bid_lock_degraded_total` increases
- **AND** `components.auction_engine.bid_lock_busy_total` is not increased for that Redis error

## MODIFIED Requirements

### Requirement: Component health response
The health endpoint SHALL return top-level status, check timestamp, and component entries for DB, Redis, and auction engine.

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
- **AND** `components.auction_engine.bid_lock_degraded_total` reports Redis lock acquisition error fallbacks
- **AND** `components.auction_engine.ws_connections_current` reports current WebSocket connections

### Requirement: Local performance evidence
The system SHALL provide local tooling and documentation to demonstrate auction bid throughput and realtime connection observability without external monitoring infrastructure.

#### Scenario: Local load script exercises a live auction
- **GIVEN** the backend is running
- **AND** a live auction id and user tokens are available
- **WHEN** a developer runs the load script with bid concurrency options
- **THEN** the script sends concurrent bid requests to `POST /api/v1/auctions/:id/bid`
- **AND** the script prints request count, success count, failure count, average latency, percentile latency, max latency, and status-code distribution
- **AND** the script can optionally open WebSocket room connections when a WebSocket runtime is available

#### Scenario: Performance report explains demo evidence
- **GIVEN** a judge or presenter opens `docs/performance-report.md`
- **WHEN** they read the report template
- **THEN** it explains how to run local load checks
- **AND** it defines each `/healthz` auction-engine metric
- **AND** it includes final-state checks for active bid uniqueness, order uniqueness, wallet non-negativity, and WebSocket connection observation
- **AND** it provides a concise narrative for the local single-process scope
