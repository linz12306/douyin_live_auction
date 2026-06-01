# Performance Evidence Report

> Fill this in during the local demo run. Metrics are process-local and reset when the backend restarts.

## Scope

This project uses lightweight in-memory observability for the MVP demo. It does not use Prometheus, Redis Pub/Sub, or multi-instance aggregation. The goal is to prove the single backend process can expose bid traffic, success rate, average latency, lock contention, and WebSocket connection count while local concurrent traffic is running.

## Setup

1. Start MySQL and Redis with the project's normal local configuration.
2. Start the backend:

```bash
cd backend
SERVER_PORT=8080 DISABLE_RATE_LIMIT=1 /Users/vivix/.local/go/bin/go run ./cmd/server
```

3. Prepare a live auction and user tokens. The existing demo seed can create demo users and an active auction:

```bash
npm run demo:seed
```

4. Export or copy at least two user access tokens for accounts with role `user`.

## Load Command

```bash
LOAD_AUCTION_TOKENS="tokenA,tokenB,tokenC" \
node scripts/load-auction.mjs \
  --base-url http://127.0.0.1:8080 \
  --auction-id 42 \
  --requests 100 \
  --concurrency 20 \
  --start-amount 200 \
  --bid-step 5 \
  --ws-connections 10
```

Smoke check:

```bash
node scripts/load-auction.mjs --help
```

Inspect backend metrics:

```bash
curl http://127.0.0.1:8080/healthz
```

## Metric Definitions

| Field | Meaning |
| --- | --- |
| `components.auction_engine.bid_requests_total` | Total observed bid attempts entering the user bid workflow. |
| `components.auction_engine.bid_success_total` | Bid attempts that completed successfully. |
| `components.auction_engine.bid_failure_total` | Bid attempts that returned an error, including validation, balance, closed auction, and lock-busy outcomes. |
| `components.auction_engine.bid_success_rate` | Successful bids divided by total observed bid attempts. |
| `components.auction_engine.bid_avg_latency_ms` | Average wall-clock latency for observed bid attempts in the backend process. |
| `components.auction_engine.bid_lock_busy_total` | Count of Redis bid lock contention outcomes where `SETNX` found the auction lock already held. |
| `components.auction_engine.ws_connections_current` | Current WebSocket room connections from the in-process realtime hub. |
| `components.auction_engine.active_rooms` | Current auction rooms with at least one WebSocket client. |
| `components.auction_engine.connected_clients` | Backward-compatible WebSocket client count; should match `ws_connections_current`. |
| `components.auction_engine.dropped_events` | Best-effort realtime event deliveries dropped because subscriber buffers were full. |

## Results

| Run | Requests | Concurrency | WS Connections | Script Success Rate | `/healthz` Bid Success Rate | Avg Latency MS | Lock Busy Total | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |

## Demo Narrative

1. Show `/healthz` before load: DB/Redis are healthy and auction metrics are near zero after backend restart.
2. Run `scripts/load-auction.mjs` with concurrent bid requests and optional WebSocket connections.
3. Show the script summary: request count, success/failure count, average client-observed latency, and status-code distribution.
4. Refresh `/healthz`: backend counters now show bid request volume, success/failure totals, success rate, average backend latency, lock-busy count, and current WebSocket connection count.
5. Explain the scope: this is intentionally local single-process evidence for the MVP; distributed aggregation and Redis Pub/Sub are future architecture work, not part of this slice.
