# Design: perf-observability

## Overview

This change strengthens observability evidence while staying inside the MVP architecture. The backend will keep lightweight in-memory counters for the bid path, merge them with existing realtime hub stats, and expose the snapshot through `/healthz`. A local script will generate concurrent bid traffic and optional WebSocket connections so judges can see the metrics move during a demo.

## Metrics Collector

Add a small `AuctionMetrics` type in the service layer. It owns atomic counters for:

- total bid requests
- successful bid requests
- failed bid requests
- accumulated bid latency in nanoseconds
- lock-busy outcomes

The collector exposes a snapshot with derived fields:

- success rate as a float in the range `0..1`
- average latency in milliseconds

The collector is process-local by design. It does not persist metrics or aggregate across instances.

## Bid Instrumentation

`AuctionService.PlaceBid` records one bid request after the user-role guard allows the request to enter the bid workflow. It measures wall-clock latency around the existing lock and transaction path. The final result determines success or failure.

Lock contention is counted only when lock acquisition returns `ErrAuctionLockBusy`. Redis errors continue to follow current behavior, where lock acquisition falls back to no lock rather than failing the bid.

Instrumentation must not change bid validation, wallet mutation, transaction boundaries, audit logs, settlement, or realtime event publishing.

## Health Surface

The existing `/healthz` endpoint remains the only public observability surface for this change. The `auction_engine` component keeps existing fields and adds:

- `bid_requests_total`
- `bid_success_total`
- `bid_failure_total`
- `bid_success_rate`
- `bid_avg_latency_ms`
- `bid_lock_busy_total`
- `ws_connections_current`

`ws_connections_current` mirrors the current connected client count from the hub. Existing `connected_clients` remains for backward compatibility.

## Load Script

Add `scripts/load-auction.mjs`. It should:

- print usage with `--help` without contacting the backend
- accept base URL, auction id, bearer tokens, request count, concurrency, starting bid amount, bid step, and optional WebSocket connection count
- send concurrent `POST /api/v1/auctions/:id/bid` requests
- optionally open WebSocket connections to `/ws/auctions/:id?token=...` when a WebSocket implementation is available in Node
- print request totals, success/failure counts, average latency, and a reminder to inspect `/healthz`

The script does not seed data. Operators should use existing demo setup or manually provide a live auction and user tokens.

## Report Template

Add `docs/performance-report.md` with:

- setup commands
- load-script command examples
- `/healthz` fields and meanings
- a fill-in results table
- a short demo narrative explaining the local, single-process scope

## Verification

Minimum verification:

- focused Go tests for metrics and health mapping
- full backend tests
- `node scripts/load-auction.mjs --help`
- `npx -y @fission-ai/openspec@latest validate perf-observability --strict --no-interactive` before implementation
- `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive` after archive or persistent spec update
- `git diff --check`

## Risks and Mitigations

- **Metrics races:** use `sync/atomic` and snapshot derived values from atomic loads.
- **Scope creep into distributed observability:** state process-local scope in code/docs and avoid Redis Pub/Sub or Prometheus.
- **Load script fragility:** make `--help` dependency-free and keep actual runs configurable rather than tied to one seeded dataset.
- **Health contract churn:** preserve existing health fields and only add requested metrics.
