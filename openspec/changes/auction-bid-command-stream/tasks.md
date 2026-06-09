# Tasks: auction-bid-command-stream

- [x] 1. Exploration and OpenSpec lock
  - Read `AGENTS.md`, latest requirements/source-of-truth/progress docs, current auction/order/wallet/realtime/load code, prior `auction-consistency-load-evidence`, and `distributed-realtime-backplane`.
  - Create Superpowers exploration document.
  - Create OpenSpec proposal/design/tasks/spec deltas.
  - Run `npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive`.
  - Run `git diff --check`.

- [x] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-09-auction-bid-command-stream.md`.
  - Break implementation into TDD slices for migration/repository, enqueue/query API, worker/core refactor, realtime status, load/docs, and verification.

- [x] 3. Command schema and repository
  - Add `backend/migrations/010_create_auction_bid_commands.sql`.
  - Add bid command DTO/model/repository code for create-or-find, owner-scoped fetch, status transitions, ordered queued selection by auction, and completion.
  - Add focused tests for duplicate idempotency, owner scoping, and status transitions.

- [x] 4. Async enqueue and query API
  - Add `POST /api/v1/auctions/:id/bid/async`.
  - Add `GET /api/v1/auctions/:id/bid-commands/:command_id`.
  - Return `202 Accepted` for queued/processing commands and safe command response bodies.
  - Add integration tests for duplicate enqueue and scoped query.

- [x] 5. Shared bid core and worker
  - Refactor `AuctionService.PlaceBid` so sync and async paths share the transaction core.
  - Add Redis Stream producer/consumer group code for `auction_bid_commands`.
  - Add worker draining with per-auction Redis lock and DB ordered command processing.
  - Add tests for same-auction ordering, multi-auction parallel processing, and worker re-delivery/restart safety.

- [x] 6. Realtime command status
  - Add private `bid_command` event and WebSocket message payload.
  - Publish queued/processing/accepted/rejected/failed command status to the command owner when possible.
  - Add backend realtime tests and optional frontend store/API handling without making async bidding default.

- [x] 7. Load tooling and performance report
  - Extend `scripts/load-auction.mjs` with `--bid-mode sync|queued`, async enqueue, command polling, enqueue latency percentiles, worker outcome counts, queue lag, and final-state guidance.
  - Update `docs/performance-report.md` with sync versus queued comparison table, SQL checks, and architecture narrative.

- [x] 8. Verification and memory
  - Run `cd backend && /Users/vivix/.local/go/bin/go test ./...`.
  - Run frontend tests/build if frontend code changes.
  - Run `node scripts/load-auction.mjs --help`.
  - Run OpenSpec strict validation and `git diff --check`.
  - Update OpenSpec tasks, Superpowers plan checkboxes, and project memory with results and remaining risks.
  - Verification:
    - `cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./...` passed.
    - `cd frontend && npm run test` passed.
    - `cd frontend && npm run build` passed.
    - `node scripts/load-auction.mjs --help` passed.
    - `npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive` passed.
    - `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive` passed.
    - `git diff --check` passed.

- [x] 9. WebSocket concurrency optimization follow-up
  - Record root cause from WS load evidence: async enqueue publishes too many `queued` command events and Redis realtime subscriber buffers are too small for bursty Hub processing.
  - Add tests proving queued enqueue does not flood the shared realtime backplane and Redis Stream subscribers can absorb a local burst without drops.
  - Suppress per-command `queued` realtime publication while keeping HTTP queued responses and worker-owned command progress/final outcomes.
  - Increase Redis realtime subscriber buffering enough for the local `5000/500/300WS` load-test envelope.
  - Re-run backend tests, OpenSpec validation, and WS load smoke.
  - Verification:
    - `TestRedisStreamAuctionEventBusBuffersBurstySubscriberWithoutDrops` failed with 240 dropped events before the buffer change, then passed.
    - `TestAsyncBidCommandEnqueueDoesNotPublishQueuedRealtimeEvent` failed with a queued realtime event before suppressing enqueue publication, then passed.
    - `cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./...` passed.
    - `npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive` passed.
    - Local `5000/500/300WS` queued load on auction `565` returned `5000/5000` HTTP 202, worker `pending=0`, `failed=0`, Redis command group `pending=0/lag=0`, and `/healthz` `dropped_events=0`.
