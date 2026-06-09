## ADDED Requirements

### Requirement: Bid command queue observability
The health and local performance evidence surfaces SHALL expose lightweight asynchronous bid command processing metrics.

#### Scenario: Health includes bid command metrics
- **GIVEN** bid commands have been enqueued or processed
- **WHEN** a client requests `GET /healthz`
- **THEN** `components.auction_engine` includes async command enqueue, processing, accepted, rejected, and failed totals
- **AND** it includes a queue lag indicator for queued bid commands when available

#### Scenario: Load script compares sync and queued modes
- **GIVEN** the backend is running with an active auction
- **WHEN** a developer runs `node scripts/load-auction.mjs --bid-mode queued`
- **THEN** the script sends bid requests to the async enqueue endpoint
- **AND** it reports HTTP enqueue success rate
- **AND** it reports enqueue p50, p95, and max latency
- **AND** it polls command outcomes to report accepted, rejected, failed, and still-pending counts

#### Scenario: Performance report explains queued architecture
- **GIVEN** a judge or presenter opens `docs/performance-report.md`
- **WHEN** they read the async queue section
- **THEN** it explains HTTP layer peak shaving, smoother DB writes, per-auction ordering, different-auction parallelism, and final-state SQL checks
- **AND** it states Redis Streams is the current lightweight course-project MQ while Kafka or RocketMQ are future enterprise replacements
