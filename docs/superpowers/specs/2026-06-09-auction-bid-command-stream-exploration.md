# auction-bid-command-stream Exploration

## Goal

Upgrade the current synchronous Redis-lock bid path with an optional asynchronous bid command stream. HTTP can enqueue bid commands quickly, workers process core auction state in order per `auction_id`, and accepted bid results continue to flow through the existing Redis Streams realtime backplane and WebSocket rooms.

## User-Facing Checkpoint

The user explicitly requested the full Superpowers + OpenSpec workflow for this architecture change and then approved the implementation plan with "PLEASE IMPLEMENT THIS PLAN". This document records that request as approval to create the workflow lock documents in the current turn.

The selected architecture is:

- Keep `POST /api/v1/auctions/:id/bid` as the synchronous fallback.
- Add `POST /api/v1/auctions/:id/bid/async` and `GET /api/v1/auctions/:id/bid-commands/:command_id`.
- Use MySQL as the canonical bid command status store.
- Use Redis Stream `auction_bid_commands` as the lightweight queue/wakeup transport.
- Reuse the existing bid transaction core for wallet freeze/unfreeze, active bid replacement, ceiling settlement, order creation, and realtime event publication.
- Preserve the existing demo loop by keeping synchronous bidding as the default frontend path in this first phase.

Commit and push are still explicitly out of scope until the user requests them.

## Current State

- The branch `codex/auction-consistency-load-plan` is already an isolated worktree.
- The worktree has uncommitted prior-stage work for:
  - `distributed-realtime-backplane`, including `backend/internal/realtime/redis_stream_bus.go`.
  - `auction-consistency-load-evidence`, including optional synchronous bid idempotency and `backend/migrations/009_create_auction_bid_requests.sql`.
  - enhanced `scripts/load-auction.mjs` and `docs/performance-report.md`.
- `AuctionService.PlaceBid` currently validates role and optional `X-Idempotency-Key`, acquires Redis `SETNX` lock, runs a MySQL transaction, mutates wallet/bid/auction/order state, stores accepted keyed responses in `auction_bid_requests`, and publishes realtime events after commit.
- `orders.auction_id` is unique, which remains the hard guard against duplicate order creation.
- The realtime backplane uses Redis Stream `auction_events` for broadcast semantics: every backend instance independently reads committed auction events and fans out to local WebSocket clients.
- The H5 live room calls only `POST /api/v1/auctions/:id/bid` and treats WebSocket messages as the realtime truth source.
- OpenSpec CLI is available via `npx -y @fission-ai/openspec@latest`.

## Non-Goals

- Do not remove or weaken the synchronous bid endpoint.
- Do not make the H5 demo depend on async bidding by default in this first phase.
- Do not replace Redis Streams with Kafka, RocketMQ, or another external MQ.
- Do not change auction price rules, wallet semantics, order statuses, or settlement policy except where needed to route async commands through the same existing business logic.
- Do not commit or push.

## Acceptance Criteria

- OpenSpec `auction-bid-command-stream` validates with `--strict`.
- Async enqueue returns `202 Accepted` for new commands and returns the existing command for duplicate `(auction_id,user_id,X-Idempotency-Key)`.
- Command query returns only commands owned by the authenticated user for the matching auction.
- Duplicate async idempotency keys never create duplicate commands, duplicate bids, duplicate freezes, or duplicate orders.
- Same-auction commands are processed in deterministic DB order.
- Different auctions can be processed concurrently by workers.
- Worker re-delivery or restart cannot double-freeze, double-unfreeze, double-deduct, or double-create orders.
- Accepted async commands publish the same committed realtime events as synchronous bids.
- Rejected/failed commands are observable through the query API and private realtime status message.
- Load tooling can compare sync and queued modes and report enqueue latency, command outcomes, queue lag, final active bid count, wallet non-negativity, and order uniqueness guidance.
- Existing synchronous bid and frontend demo behavior remain valid.

## Risks

- **Duplicating bid logic:** copying wallet/order code into a worker would create divergence. Mitigation: refactor `PlaceBid` into a shared core that both sync and async worker paths call.
- **Same-auction ordering:** Redis consumer groups distribute messages, but stream message order alone is not enough when multiple workers receive messages for the same auction. Mitigation: use a short Redis per-auction worker lock and drain queued DB rows ordered by command id for that auction.
- **Sync versus async races:** synchronous bids can still occur while async commands are queued. Mitigation: the shared core keeps MySQL `FOR UPDATE` serialization and existing state validation; async ordering applies among queued commands, not across all possible sync fallback requests.
- **Worker duplicate delivery:** Redis Streams pending entries can be retried. Mitigation: command state transitions and core idempotency keys make processing reentrant.
- **Queryable state loss:** Redis-only results would be fragile under trimming or restart. Mitigation: MySQL is the command status source of truth.
- **Migration shape:** MySQL unique constraints do not treat `NULL` values as equal. Mitigation: store absent client idempotency as `NULL` but only rely on uniqueness when the key is present; generated `command_id` is always unique.

## Technical Direction

- Add `auction_bid_commands` with durable command state and status timestamps.
- Add repository methods to create or find commands, transition `queued -> processing`, complete accepted/rejected/failed commands, list queued commands by auction, and fetch by command id/owner.
- Add a bid command queue abstraction around Redis Streams with `XADD`, consumer group creation, `XREADGROUP`, `XACK`, and bounded stream trimming.
- Add an `AuctionBidCommandService` or focused methods on `AuctionService` for enqueue/query/work processing.
- Refactor the synchronous bid path so the transaction core can accept a caller-supplied idempotency key and an option to skip the outer Redis fail-fast bid lock when already serialized by the worker.
- Start the worker from `cmd/server` behind enabled-by-default config with safe concurrency settings and stream key defaults.
- Add realtime `bid_command` private message support without changing existing `price_update`, `outbid`, `extended`, or `auction_end` contracts.
- Extend load tooling and performance docs after backend behavior is in place.
