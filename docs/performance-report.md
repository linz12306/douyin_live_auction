# Performance Evidence Report

> Metrics are process-local and reset when the backend restarts. This report proves the local single-backend MVP path; cloud deployment is not required before validating Redis locking, MySQL row locks, wallet consistency, or local WebSocket observability.

## Scope

This project uses lightweight process-local observability for the MVP demo. It does not use Prometheus or multi-instance metric aggregation. The goal is to prove one backend process can expose bid traffic, success rate, latency, Redis lock contention, Redis lock degradation, and WebSocket connection count while concurrent local traffic is running.

The backend realtime event bus now uses Redis Streams by default for multi-backend WebSocket fanout. This report's numeric load evidence is still intentionally local and single-backend unless a two-backend smoke section is added.

The bid path now also has an optional async queued mode. The original synchronous endpoint remains available as a fallback, while `POST /api/v1/auctions/:id/bid/async` writes a durable bid command and wakes a Redis Streams worker. Workers process commands in order per auction and may process different auctions in parallel.

## Setup

Start MySQL and Redis:

```bash
docker compose up -d mysql redis
```

Start the backend from source:

```bash
cd backend
SERVER_PORT=8080 DISABLE_RATE_LIMIT=1 REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go run ./cmd/server
```

Prepare a live auction and demo accounts:

```bash
DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed
```

The seed output includes `auction.auctionId`. Demo users:

- `demo_buyer_a` / `test123`
- `demo_buyer_b` / `test123`

## Load Commands

Smoke check:

```bash
node scripts/load-auction.mjs --help
```

Concurrent bid load with demo login:

```bash
node scripts/load-auction.mjs \
  --base-url http://127.0.0.1:8080 \
  --auction-id <auction_id> \
  --login-users demo_buyer_a:test123,demo_buyer_b:test123 \
  --requests 100 \
  --concurrency 20 \
  --start-amount 200 \
  --bid-step 25 \
  --ws-connections 10 \
  --verify-final-state
```

Queued bid command load:

```bash
node scripts/load-auction.mjs \
  --base-url http://127.0.0.1:8080 \
  --auction-id <auction_id> \
  --login-users demo_buyer_a:test123,demo_buyer_b:test123 \
  --requests 100 \
  --concurrency 20 \
  --start-amount 200 \
  --bid-step 25 \
  --ws-connections 10 \
  --bid-mode queued \
  --command-timeout-ms 15000 \
  --verify-final-state
```

Alternative with pre-copied tokens:

```bash
LOAD_AUCTION_TOKENS="tokenA,tokenB,tokenC" \
node scripts/load-auction.mjs \
  --base-url http://127.0.0.1:8080 \
  --auction-id <auction_id> \
  --requests 100 \
  --concurrency 20 \
  --start-amount 200 \
  --bid-step 25 \
  --ws-connections 10 \
  --verify-final-state
```

Inspect backend metrics before and after load:

```bash
curl http://127.0.0.1:8080/healthz
```

## Metric Definitions

| Field | Meaning |
| --- | --- |
| `components.auction_engine.bid_requests_total` | Total observed bid attempts entering the user bid workflow. |
| `components.auction_engine.bid_success_total` | Bid attempts that completed successfully, including idempotent replays. |
| `components.auction_engine.bid_failure_total` | Bid attempts that returned an error, including validation, balance, closed auction, and lock-busy outcomes. |
| `components.auction_engine.bid_success_rate` | Successful bids divided by total observed bid attempts. |
| `components.auction_engine.bid_avg_latency_ms` | Average wall-clock latency for observed bid attempts in the backend process. |
| `components.auction_engine.bid_lock_busy_total` | Count of Redis `SETNX` outcomes where the auction lock was already held and the request returned 429. |
| `components.auction_engine.bid_lock_degraded_total` | Count of Redis lock acquisition errors where the backend fell back to MySQL row-lock serialization. |
| `components.auction_engine.ws_connections_current` | Current WebSocket room connections from the in-process realtime hub. |
| `components.auction_engine.active_rooms` | Current auction rooms with at least one WebSocket client. |
| `components.auction_engine.connected_clients` | Backward-compatible WebSocket client count; should match `ws_connections_current`. |
| `components.auction_engine.dropped_events` | Best-effort Redis Streams realtime subscriber deliveries dropped because subscriber buffers were full. |
| `components.auction_engine.bid_command_enqueue_total` | Async bid commands observed at enqueue time. |
| `components.auction_engine.bid_command_processing_total` | Async bid commands claimed by a worker. |
| `components.auction_engine.bid_command_accepted_total` | Async bid commands accepted by the shared bid core. |
| `components.auction_engine.bid_command_rejected_total` | Async bid commands rejected by business validation. |
| `components.auction_engine.bid_command_failed_total` | Async bid commands that hit unexpected worker/infrastructure failure. |

## Result Format

| Run | Requests | Concurrency | WS Connections | Script Success Rate | Status Counts | Avg MS | P50 MS | P95 MS | Max MS | Health Success Rate | Lock Busy | Lock Degraded | Notes |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 100 | 20 | 10 opened / 0 after script close | 0.03 | `{"200":3,"429":97}` | 6.43 | 4.75 | 12.52 | 20.86 | 0.03 | 97 | 0 | Local sample on `127.0.0.1:18080`, auction `181`; high lock contention proves Redis SETNX serialization. |
| 2 | 300 | 50 | 20 opened / 0 after script close | 0.0267 | `{"200":8,"429":292}` | 15.03 | 12.27 | 33.06 | 40.62 | 0.0267 | 292 | 0 | Dedicated auction `182`; first high-QPS step. |
| 3 | 800 | 150 | 50 opened / 0 after script close | 0.0188 | `{"200":15,"400":3,"429":782}` | 35.51 | 31.53 | 67.26 | 70.28 | cumulative 0.0209 | cumulative 1074 | 0 | `400` means late low bids rejected after current price advanced. |
| 4 | 2000 | 300 | 100 opened / 0 after script close | 0.0140 | `{"200":28,"400":9,"429":1963}` | 60.99 | 55.60 | 104.00 | 110.37 | cumulative 0.0165 | cumulative 3037 | 0 | Strong local concurrency step; no 5xx or timeouts. |
| 5 | 5000 | 500 | 150 opened / 0 after script close | 0.0128 | `{"200":64,"400":12,"429":4924}` | 132.97 | 113.51 | 343.67 | 391.10 | cumulative 0.0142 | cumulative 7961 | 0 | Highest local step run in this pass; backend remained healthy. |

## Sync vs Queued Comparison

Use this table for the next evidence pass. Sync mode measures end-to-end HTTP bid acceptance under Redis lock contention. Queued mode measures fast HTTP enqueue separately from worker outcomes.

| Mode | Requests | Concurrency | HTTP Success Rate | HTTP Status Counts | Enqueue P50 MS | Enqueue P95 MS | Enqueue Max MS | Worker Accepted | Worker Rejected | Worker Failed | Pending | Max Queue Lag MS | Active Bid Count | Wallet Non-Negative | Order Unique | Notes |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| sync |  |  |  |  |  |  |  | n/a | n/a | n/a | n/a | n/a |  |  |  | Redis `SETNX` fail-fast protects consistency but returns 429 during hot contention. |
| queued |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | HTTP layer absorbs the burst; worker smooths DB writes per auction. |

Queued JSON fields to copy:

- `successRate`: HTTP enqueue success rate.
- `latencyMS.p50`, `latencyMS.p95`, `latencyMS.max`: enqueue latency.
- `workerOutcomes.statuses.accepted`, `workerOutcomes.statuses.rejected`, `workerOutcomes.statuses.failed`, `workerOutcomes.statuses.pending`.
- `workerOutcomes.queueLagMS.max`.

Run 1 final-state evidence:

- `active_bid_count = 1`
- `order_count = 0`
- auction status/current price/highest bidder: `active / 2125.00 / 460`
- `MIN(balance) = 5.00`, `MIN(frozen_amount) = 0.00`
- `won_bid_count = 0`

Run 5 final-state evidence for dedicated auction `182`:

- `active_bid_count = 1`
- `order_count = 0`
- auction status/current price/highest bidder: `active / 84970.00 / 492`
- all users: `MIN(balance) = 5.00`, `MIN(frozen_amount) = 0.00`
- dedicated `lugaa%` users: `MIN(balance) = 915030.00`, `MAX(frozen_amount) = 84970.00`
- top bids: `84970.00 active`, then `84100.00 outbid`, `82950.00 outbid`, `82390.00 outbid`, `81300.00 outbid`

Copy script fields from JSON:

- `requests`
- `success`
- `failure`
- `successRate`
- `latencyMS.avg`
- `latencyMS.p50`
- `latencyMS.p95`
- `latencyMS.max`
- `wsOpened`
- `statuses`
- `finalState.healthAuctionEngine`
- `finalState.rankingTop`

## Final-State SQL Evidence

Use these checks after a run. Replace `<auction_id>` with the seeded auction id.

```sql
SELECT COUNT(*) AS active_bid_count
FROM bids
WHERE auction_id = <auction_id> AND status = 'active';
```

Expected for a non-terminal auction: `active_bid_count = 1`.

```sql
SELECT status, current_price, highest_bidder_id
FROM auctions
WHERE id = <auction_id>;
```

Expected: `current_price` and `highest_bidder_id` match the active bid or terminal winning bid.

```sql
SELECT COUNT(*) AS order_count
FROM orders
WHERE auction_id = <auction_id>;
```

Expected after成交: `order_count = 1`. Expected before成交: `order_count = 0`.

```sql
SELECT MIN(balance) AS min_balance, MIN(frozen_amount) AS min_frozen
FROM users
WHERE role = 'user';
```

Expected: both values are `>= 0`.

```sql
SELECT COUNT(*) AS won_bid_count
FROM bids
WHERE auction_id = <auction_id> AND status = 'won';
```

Expected after成交: `won_bid_count = 1`.

```sql
SELECT status, COUNT(*) AS command_count
FROM auction_bid_commands
WHERE auction_id = <auction_id>
GROUP BY status
ORDER BY status;
```

Expected in queued mode: terminal command counts explain worker accepted/rejected/failed outcomes; `queued` or `processing` should trend to zero after the polling timeout unless the worker is intentionally stopped.

```sql
SELECT COUNT(*) AS duplicate_orders
FROM (
  SELECT auction_id
  FROM orders
  WHERE auction_id = <auction_id>
  GROUP BY auction_id
  HAVING COUNT(*) > 1
) t;
```

Expected: `duplicate_orders = 0`.

## Queued Architecture Narrative

The queued bid path is a lightweight high-concurrency architecture upgrade for the course project:

1. HTTP peak shaving: requests append a bid command and return quickly instead of all competing for the same hot Redis bid lock.
2. Smooth DB writes: workers drain commands at a controlled pace, so MySQL sees ordered state transitions instead of a burst of lock contenders.
3. Per-auction ordering: a short Redis worker lock plus DB command ordering ensures one auction's commands are applied sequentially.
4. Cross-auction parallelism: different auctions use different worker locks, so hot auction A does not block auction B.
5. Realtime continuity: accepted commands still publish committed `auction_events`, so existing WebSocket `price_update`, `outbid`, `extended`, and `auction_end` messages remain the user-visible truth source.

Redis Streams is the current lightweight MQ/backplane because it is already in the stack and fits the local demo. Kafka or RocketMQ would be the enterprise replacement path for stronger retention, partitioning, replay tooling, and cross-service governance, but they are not required before this stage is demonstrable.

## WebSocket Backpressure Follow-up

The first queued-mode WS pressure run showed the bid command path remained correct, but realtime backplane drops appeared under a dense room fanout:

| Build | Requests | HTTP Concurrency | WS Connections | HTTP 202 | Worker Pending | Worker Failed | Redis Command Pending/Lag | Realtime Dropped Events | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| before WS optimization | 5000 | 500 | 300 | 5000/5000 | 0 | 0 | `0 / 0` | +310 | Drops came from local `auction_events` subscriber pressure, not from bid command consumption. |
| after WS optimization | 5000 | 500 | 300 | 5000/5000 | 0 | 0 | `0 / 0` | 0 | Async enqueue no longer publishes one `queued` WS backplane event per command, and Redis realtime subscriber buffer is enlarged to absorb local bursts. |

Optimized run details on auction `565`:

- Enqueue latency: p50 `235.46ms`, p95 `524.77ms`, max `1226.17ms`.
- Worker outcomes: `accepted 246`, `rejected 4754`, `failed 0`, `pending 0`.
- Queue lag max: `62000ms`.
- DB checks: `active bid = 1`, `orders = 0`, user wallet balance/frozen values remain non-negative.
- Redis command group: `pending = 0`, `lag = 0`.

Design note: `queued` is still returned by `POST /api/v1/auctions/:id/bid/async` and persisted in MySQL. The realtime backplane now focuses on worker-owned progress and committed auction outcomes, avoiding a burst of user-private `queued` events that do not add state beyond the HTTP response.

## Demo Narrative

1. Show `/healthz` before load: DB/Redis are healthy and auction metrics are near zero after backend restart.
2. Run `scripts/load-auction.mjs` with concurrent bid requests and optional WebSocket connections.
3. Show the script summary: request count, success/failure count, status distribution, average/p50/p95/max latency, opened WebSocket count, health metrics, and top ranking.
4. Refresh `/healthz`: backend counters now show bid request volume, success/failure totals, success rate, average backend latency, lock-busy count, lock-degraded count, and WebSocket connection count.
5. Run the SQL checks to prove active bid uniqueness,成交唯一性, and wallet non-negativity.
6. Explain the scope: this is intentionally local single-process numeric evidence for the MVP; Redis Streams realtime fanout is implemented separately in `distributed-realtime-backplane`, and a two-backend smoke test can be added as extra proof.
